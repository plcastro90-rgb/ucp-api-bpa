const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o PostgreSQL do Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configuração do Transporter de E-mail (Gmail ou outro serviço SMTP)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Ex: seu-email@gmail.com configurado no Render
    pass: process.env.EMAIL_PASS  // Senha de aplicativo do Gmail
  }
});

// Criar tabela de utilizadores incluindo a coluna email e colunas de recuperação
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
      organizacao VARCHAR(100) DEFAULT 'Civil / Nenhum',
      reset_token VARCHAR(255),
      reset_expires TIMESTAMP
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

  if (!nick || !pass || !email) {
    return res.json({ sucesso: false, mensagem: 'Preencha todos os campos obrigatórios.' });
  }

  try {
    const usuarioExistente = await pool.query('SELECT * FROM usuarios WHERE LOWER(nick) = LOWER($1)', [nick]);
    if (usuarioExistente.rows.length > 0) {
      return res.json({ sucesso: false, mensagem: 'Este nick já está registado na UCP.' });
    }

    const hashedPassword = await bcrypt.hash(pass, 10);
    
    await pool.query(
      `INSERT INTO usuarios (nick, senha, email) VALUES ($1, $2, $3)`,
      [nick, hashedPassword, email]
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

// Rota de Recuperação de Senha (Esqueci a Senha)
app.post('/api/forgot-password', async (req, res) => {
  const { nick, email } = req.body;

  if (!nick || !email) {
    return res.json({ sucesso: false, mensagem: 'Informe o nick e o e-mail da conta.' });
  }

  try {
    const resultado = await pool.query('SELECT * FROM usuarios WHERE LOWER(nick) = LOWER($1) AND email = $2', [nick, email]);
    
    if (resultado.rows.length === 0) {
      return res.json({ sucesso: false, mensagem: 'Conta não encontrada com este nick e e-mail.' });
    }

    // Gerar senha temporária aleatória de 6 dígitos
    const novaSenhaTemp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(novaSenhaTemp, 10);

    // Atualizar a senha no banco imediatamente
    await pool.query('UPDATE usuarios SET senha = $1 WHERE LOWER(nick) = LOWER($2)', [hashedPassword, nick]);

    // Enviar e-mail com a nova senha temporária
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Brasil Play Alpha - Recuperação de Senha',
      text: `Olá ${nick},\n\nRecebemos um pedido de recuperação de senha para a sua conta na UCP.\nA sua nova palavra-passe temporária é: ${novaSenhaTemp}\n\nRecomendamos que faça login e altere a sua senha em segurança.`
    };

    transporter.sendMail(mailOptions, (err, info) => {
      if (err) {
        console.error('Erro ao enviar e-mail:', err);
        return res.json({ sucesso: false, mensagem: 'Erro ao enviar o e-mail de recuperação.' });
      }
      res.json({ sucesso: true, mensagem: 'Uma nova senha temporária foi enviada para o seu e-mail!' });
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao processar recuperação.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor UCP conectado ao Neon rodando na porta ${PORT}`);
});
