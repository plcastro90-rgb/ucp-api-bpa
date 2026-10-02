const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão segura usando Variáveis de Ambiente do Render
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

db.connect(err => {
  if (err) {
    console.error('Erro ao conectar ao MySQL do SA-MP:', err);
    return;
  }
  console.log('Conectado ao banco de dados do SA-MP com sucesso!');
});

// Rota de Login
app.post('/api/login', (req, res) => {
  const { nick, pass } = req.body;

  if (!nick || !pass) {
    return res.json({ sucesso: false, mensagem: 'Preencha todos os campos.' });
  }

  // ATENÇÃO: Ajuste 'contas' para o nome exato da tabela do seu gamemode (ex: players, users)
  // e 'nome' / 'senha' para as colunas reais.
  const query = 'SELECT * FROM contas WHERE nome = ? AND senha = ?';

  db.query(query, [nick, pass], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ sucesso: false, mensagem: 'Erro interno no servidor.' });
    }

    if (results.length > 0) {
      const user = results[0];
      res.json({
        sucesso: true,
        usuario: {
          nick: user.nome,
          id: user.id || 1492,
          rg: user.rg || 89210,
          dinheiro: user.dinheiro || 0,
          banco: user.banco || 0,
          level: user.level || 1,
          organizacao: user.org || 'Civil / Nenhum'
        }
      });
    } else {
      res.json({ sucesso: false, mensagem: 'Utilizador ou palavra-passe incorretos.' });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor UCP rodando na porta ${PORT}`);
});
