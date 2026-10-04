const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const filePath = path.join(__dirname, 'usuarios.json');

// Função para ler utilizadores
function lerUsuarios() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([]));
  }
  const data = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Função para salvar utilizadores
function salvarUsuarios(usuarios) {
  fs.writeFileSync(filePath, JSON.stringify(usuarios, null, 2));
}

// Rota de Registo
app.post('/api/register', async (req, res) => {
  const { nick, pass, email } = req.body;

  if (!nick || !pass) {
    return res.json({ sucesso: false, mensagem: 'Preencha o nick e a palavra-passe.' });
  }

  const usuarios = lerUsuarios();
  const existe = usuarios.find(u => u.nick.toLowerCase() === nick.toLowerCase());

  if (existe) {
    return res.json({ sucesso: false, mensagem: 'Este nick já está registado na UCP.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(pass, 10);
    const novoUsuario = {
      id: usuarios.length + 1,
      nick: nick,
      senha: hashedPassword,
      email: email || '',
      dinheiro: 5000.00,
      banco: 1000.00,
      level: 1,
      organizacao: 'Civil / Nenhum'
    };

    usuarios.push(novoUsuario);
    salvarUsuarios(usuarios);

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

  const usuarios = lerUsuarios();
  const user = usuarios.find(u => u.nick.toLowerCase() === nick.toLowerCase());

  if (!user) {
    return res.json({ sucesso: false, mensagem: 'Utilizador não encontrado. Crie uma conta.' });
  }

  try {
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao autenticar.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor UCP autónomo rodando na porta ${PORT}`);
});
