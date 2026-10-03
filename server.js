const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o banco de dados ISOLADO da UCP (Pode usar um banco gratuito exclusivo para o site)
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Criar a tabela UCP automaticamente se ela não existir
db.query(`
  CREATE TABLE IF NOT EXISTS ucp_usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nick VARCHAR(50) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    dinheiro DECIMAL(12,2) DEFAULT 5000.00,
    banco DECIMAL(12,2) DEFAULT 1000.00,
    level INT DEFAULT 1,
    organizacao VARCHAR(50) DEFAULT 'Civil / Nenhum',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`, (err) => {
  if (err) console.error('Erro ao criar tabela UCP:', err);
  else console.log('Tabela UCP independente verificada/criada com sucesso.');
});

// Rota de Registo Independente
app.post('/api/register', async (req, res) => {
  const { nick, pass, email } = req.body;

  if (!nick || !pass) {
    return res.json({ sucesso: false, mensagem: 'Preencha o nick e a palavra-passe.' });
  }

  try {
    // Verifica se o nick já existe na UCP
    db.query('SELECT * FROM ucp_usuarios WHERE nick = ?', [nick], async (err, results) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
      }

      if (results.length > 0) {
        return res.json({ sucesso: false, mensagem: 'Este nick já está registado na UCP.' });
      }

      // Encripta a senha com bcrypt (Segurança máxima, o dono do servidor nem ninguém consegue ver a senha real)
      const hashedPassword = await bcrypt.hash(pass, 10);

      const insertQuery = 'INSERT INTO ucp_usuarios (nick, senha, email) VALUES (?, ?, ?)';
      db.query(insertQuery, [nick, hashedPassword, email || ''], (err, result) => {
        if (err) {
          console.error(err);
          return res.status(500).json({ sucesso: false, mensagem: 'Erro ao registar conta.' });
        }

        res.json({ sucesso: true, mensagem: 'Conta criada com sucesso na UCP!' });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro ao processar o registo.' });
  }
});

// Rota de Login Independente
app.post('/api/login', (req, res) => {
  const { nick, pass } = req.body;

  if (!nick || !pass) {
    return res.json({ sucesso: false, mensagem: 'Preencha todos os campos.' });
  }

  db.query('SELECT * FROM ucp_usuarios WHERE nick = ?', [nick], async (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
    }

    if (results.length === 0) {
      return res.json({ sucesso: false, mensagem: 'Utilizador não encontrado.' });
    }

    const user = results[0];

    // Compara a senha digitada com o hash seguro guardado no banco
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
        dinheiro: user.dinheiro,
        banco: user.banco,
        level: user.level,
        organizacao: user.organizacao
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor UCP autónomo rodando na porta ${PORT}`);
});
