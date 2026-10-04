const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json());
app.use(cors());

const filePath = path.join(__dirname, 'usuarios.json');

// Configuração do Nodemailer com as credenciais da Brevo
const transporter = nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    auth: {
        user: 'plcastro90@gmail.com',
        pass: 'Xsmtpsib-ce9203d3c7001c5d0e28afaab606ca48e4f008e99185a3f3f567203bb63cc9b9-Me6CRPPSPG8ZrEqx'
    }
});

// Objeto temporário para guardar os códigos gerados por e-mail
const codigosTemporarios = {};

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

// Rota para Enviar o Código de Verificação por E-mail
app.post('/api/enviar-codigo', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ sucesso: false, mensagem: 'E-mail obrigatório.' });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    codigosTemporarios[email] = codigo;

    try {
        await transporter.sendMail({
            from: '"Brasil Play Alpha" <plcastro90@gmail.com>',
            to: email,
            subject: 'Código de Verificação UCP - Brasil Play Alpha',
            text: `O seu código de verificação para criar a conta é: ${codigo}`
        });
        res.json({ sucesso: true, mensagem: 'Código enviado com sucesso para o e-mail!' });
    } catch (erro) {
        console.error('Erro ao enviar e-mail:', erro);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao enviar o e-mail.' });
    }
});

// Rota de Registo com Validação do Código e Salvamento
app.post('/api/register', async (req, res) => {
  const { nick, pass, email, codigo } = req.body;

  if (!nick || !pass || !email || !codigo) {
    return res.json({ sucesso: false, mensagem: 'Preencha todos os campos, incluindo o código de verificação.' });
  }

  // Validar o código de verificação enviado
  if (!codigosTemporarios[email] || codigosTemporarios[email] !== codigo) {
    return res.status(400).json({ sucesso: false, mensagem: 'Código de verificação inválido ou expirado!' });
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
      email: email,
      dinheiro: 5000.00,
      banco: 1000.00,
      level: 1,
      organizacao: 'Civil / Nenhum'
    };

    usuarios.push(novoUsuario);
    salvarUsuarios(usuarios);

    // Remove o código temporário após o uso bem-sucedido
    delete codigosTemporarios[email];

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
