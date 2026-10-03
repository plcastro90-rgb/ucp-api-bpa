const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Conecta ou cria um banco de dados SQLite local automático
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Erro ao abrir o banco de dados SQLite:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite local com sucesso.');
    
    // Criar a tabela UCP automaticamente
    db.run(`
      CREATE TABLE IF NOT EXISTS ucp_usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nick TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        email TEXT,
        dinheiro REAL DEFAULT 5000.00,
        banco REAL DEFAULT 1000.00,
        level INTEGER DEFAULT 1,
        organizacao TEXT DEFAULT 'Civil / Nenhum',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (errCreate) => {
      if (errCreate) {
        console.error('Erro ao criar tabela:', errCreate.message);
      } else {
        console.log('Tabela ucp_usuarios verificada/criada com sucesso.');
      }
    });
  }
});

// Rota de Registo Independente
app.post('/api/register', async (req, res) => {
  const { nick, pass, email } = req.body;

  if (!nick || !pass) {
    return.json({ sucesso: false, mensagem: 'Preencha o nick e a palavra-passe.' });
  }

  try {
    db.get('SELECT * FROM ucp_usuarios WHERE nick = ?', [nick], async (err, row) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
      }

      if (row) {
        return res.json({ sucesso: false, mensagem: 'Este nick já está registado na UCP.' });
      }

      const hashedPassword = await bcrypt.hash(pass, 10);

      db.run(
        'INSERT INTO ucp_usuarios (nick, senha, email) VALUES (?, ?, ?)',
        [nick, hashedPassword, email || ''],
        function (errInsert) {
          if (errInsert) {
            console.error(errInsert);
            return res.status(500).json({ sucesso: false, mensagem: 'Erro ao registar conta.' });
          }

          res.json({ sucesso: true, mensagem: 'Conta criada com sucesso na UCP!' });
        }
      );
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

  db.get('SELECT * FROM ucp_usuarios WHERE nick = ?', [nick], async (err, user) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
    }

    if (!user) {
      return res.json({ sucesso: false, mensagem: 'Utilizador não encontrado. Crie uma conta.' });
    }

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
