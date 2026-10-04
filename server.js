const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());

// Configuração da conexão com o MySQL da VPS
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Configuração do Nodemailer para recuperação de senha
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Função auxiliar para gerar hash MD5 (compatível com SA-MP)
function gerarMD5(senha) {
  return crypto.createHash('md5').update(senha).digest('hex');
}

// Rota de Registo ajustada para a tabela 'usuarios' do SA-MP
app.post('/api/register', async (req, res) => {
  const { nick, pass, email } = req.body;

  if (!nick || !pass) {
    return res.json({ sucesso: false, mensagem: 'Preencha o nick e a palavra-passe.' });
  }

  try {
    const [existente] = await pool.query('SELECT * FROM usuarios WHERE LOWER(Nick) = LOWER(?)', [nick]);
    if (existente.length > 0) {
      return res.json({ sucesso: false, mensagem: 'Este nick já está registado na UCP/Servidor.' });
    }

    const senhaCriptografada = gerarMD5(pass);
    
    await pool.query(
      `INSERT INTO usuarios (Nick, Senha, Level, Dinheiro, Conta) VALUES (?, ?, 1, 5000, 1000)`,
      [nick, senhaCriptografada]
    );

    res.json({ sucesso: true, mensagem: 'Conta criada com sucesso!' });
  } catch (error) {
    console.error('Erro ao registar:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao processar o registo.' });
  }
});

// Rota de Login ajustada para a tabela 'usuarios' do SA-MP
app.post('/api/login', async (req, res) => {
  const { nick, pass } = req.body;

  if (!nick || !pass) {
    return res.json({ sucesso: false, mensagem: 'Preencha todos os campos.' });
  }

  try {
    const [resultado] = await pool.query('SELECT * FROM usuarios WHERE LOWER(Nick) = LOWER(?)', [nick]);
    
    if (resultado.length === 0) {
      return res.json({ sucesso: false, mensagem: 'Utilizador não encontrado. Crie uma conta.' });
    }

    const user = resultado[0];
    const senhaCriptografada = gerarMD5(pass);

    // Valida tanto em MD5 quanto em texto plano caso o GM salve direto
    if (user.Senha !== senhaCriptografada && user.Senha !== pass) {
      return res.json({ sucesso: false, mensagem: 'Palavra-passe incorreta.' });
    }

    res.json({
      sucesso: true,
      usuario: {
        nick: user.Nick,
        id: user.ID || 1,
        rg: (user.ID || 1) + 10000,
        dinheiro: parseFloat(user.Dinheiro || 0),
        banco: parseFloat(user.Conta || 0),
        level: user.Level || 1,
        organizacao: user.Membro || 0
      }
    });
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao autenticar.' });
  }
});

// Rota de Recuperação de Senha
app.post('/api/forgot-password', async (req, res) => {
  const { nick, email } = req.body;

  if (!nick) {
    return res.json({ sucesso: false, mensagem: 'Insira o seu nick.' });
  }

  try {
    const [resultado] = await pool.query('SELECT * FROM usuarios WHERE LOWER(Nick) = LOWER(?)', [nick]);

    if (resultado.length === 0) {
      return res.json({ sucesso: false, mensagem: 'Nenhum registo encontrado com este nick.' });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email || process.env.EMAIL_USER,
      subject: 'Brasil Play Alpha - Recuperação de Palavra-passe',
      text: `Olá ${nick}, recebemos um pedido para recuperar a palavra-passe da sua conta. Utilize as ferramentas do servidor para redefinir os seus dados.`
    };

    await transporter.sendMail(mailOptions);
    res.json({ sucesso: true, mensagem: 'Instruções enviadas com sucesso!' });
  } catch (error) {
    console.error('Erro na recuperação de senha:', error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao enviar o e-mail.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor UCP conectado ao MySQL da VPS rodando na porta ${PORT}`);
});
