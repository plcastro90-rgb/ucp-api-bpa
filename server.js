const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o PostgreSQL do Neon usando a variável de ambiente do Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Configuração do Nodemailer com as variáveis de ambiente do Render (sem espaços na senha)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Criar a tabela de utilizadores automaticamente ao iniciar o servidor
async function criarTabela() {
  const query = `
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nick VARCHAR(50) UNIQUE NOT NULL,
      senha VARCHAR(255) NOT NULL,
      email VARCHAR(100),
      dinheiro NUMERIC(12,2) DEFAULT 5000.00,
      banco NUMERIC(12,2) DEFAULT 1000.00,
      level INTEGER DEFAULT 1,
      organizacao VARCHAR(100) DEFAULT 'Civil / Nenhum'
    );
  `;
  try {
    await pool.query(query);
    console.log("Tabela 'usuarios' verificada/criada com sucesso no Neon!");
  } catch (err) {
    console.error("Erro ao criar tabela:", err);
  }
}

criarTabela();

// Rota de Registo
app.post('/api/register', async (req, res) => {
  const { nick, pass, email } = req.body;

  if (!nick || !pass) {
    return res.json({ sucesso: false, mensagem: 'Preencha o nick e a palavra-passe.' });
  }

  try {
    const usuarioExistente = await pool.query('SELECT * FROM usuarios WHERE LOWER(nick) = LOWER($1)', [nick]);
    if (usuarioExistente.rows.length > 0) {
      return res.json({ sucesso: false, mensagem: 'Este nick já está registado na UCP.' });
    }

    const hashedPassword = await bcrypt.hash(pass, 10);
    
    await pool.query(
      `INSERT INTO usuarios (nick, senha, email) VALUES ($1, $2, $3) RETURNING *`,
      [nick, hashedPassword, email || '']
    );

    res.json({ sucesso: true, mensagem: 'Conta criada com sucesso na UCP!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao processar o registo.' });
  }
});

// Rota de Login
app.post('/api/login', async (req, res) => {
  const { nick, pass } = req.body;

  if (!nick || !pass) {
    return res.json({ sucesso: false, mensagem: 'Preencha todos os campos.' });
  }

  try {
    const resultado = await pool.query('SELECT * FROM usuarios WHERE LOWER(nick) = LOWER($1)', [nick]);
    
    if (resultado.rows.length === 0) {
      return res.json({ sucesso: false, mensagem: 'Utilizador não encontrado. Crie uma conta.' });
    }

    const user = resultado.rows[0];
    const senhaCorreta = await bcrypt.compare(pass, user.senha);

    if (!senhaCorreta) {
      return res.json({ sucesso: false, mensagem: 'Palavra-passe incorreta.' });
    }

    res.json({
      sucesso: true,
      usuario: {
        nick: user.nick,
        id: user.id,
        rg: user.id + 10000,
        dinheiro: parseFloat(user.dinheiro),
        banco: parseFloat(user.banco),
        level: user.level,
        organizacao: user.organizacao
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao autenticar.' });
  }
});

// Nova Rota de Recuperação de Palavra-passe
app.post('/api/forgot-password', async (req, res) => {
  const { nick, email } = req.body;

  if (!nick || !email) {
    return res.json({ sucesso: false, mensagem: 'Preencha o nick e o e-mail de recuperação.' });
  }

  try {
    const resultado = await pool.query(
      'SELECT * FROM usuarios WHERE LOWER(nick) = LOWER($1) AND LOWER(email) = LOWER($2)',
      [nick, email]
    );

    if (resultado.rows.length === 0) {
      return res.json({ sucesso: false, mensagem: 'Nenhum registo encontrado com este nick e e-mail.' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Brasil Play Alpha - Recuperação de Palavra-passe',
      text: `Olá ${nick}, recebemos um pedido para recuperar a palavra-passe da sua conta na UCP do Brasil Play Alpha. Utilize as ferramentas do servidor para definir uma nova palavra-passe.`
    };

    await transporter.sendMail(mailOptions);

    res.json({ sucesso: true, mensagem: 'Instruções enviadas com sucesso para o seu e-mail!' });
  } catch (error) {
    console.error('Erro ao processar recuperação de senha:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao enviar o e-mail de recuperação.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor UCP conectado ao Neon rodando na porta ${PORT}`);
});
