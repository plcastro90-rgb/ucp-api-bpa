const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

app.use(express.json());
app.use(cors());

// Ligar ao MongoDB Atlas utilizando a variável de ambiente configurada no Render
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Conectado ao MongoDB Atlas com sucesso!'))
  .catch(err => console.error('Erro ao conectar ao MongoDB:', err));

// Definir o Esquema (Schema) e o Modelo do Utilizador para a base de dados
const usuarioSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  pass: { type: String, required: true },
  nick: { type: String },
  criadoEm: { type: Date, default: Date.now }
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

// Variável temporária para guardar os códigos OTP gerados
const codigosArmazenados = {};

// Rota de teste para ver se a API está online
app.get('/', (req, res) => {
  res.json({ status: "API do Brasil Play Alpha Online!" });
});

// Rota para enviar o código OTP utilizando a API HTTP da Brevo
app.post('/api/enviar-codigo', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ sucesso: false, mensagem: 'E-mail não fornecido.' });
  }

  // Gerar código aleatório de 6 dígitos
  const codigoOtp = Math.floor(100000 + Math.random() * 900000).toString();

  // Guardar o código temporariamente associado a este e-mail
  codigosArmazenados[email] = codigoOtp;

  try {
    const respostaBrevo = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.SMTP_PASS // Chave da Brevo configurada no Render
      },
      body: JSON.stringify({
        sender: {
          name: "Brasil Play Alpha",
          email: process.env.SMTP_USER // E-mail verificado na Brevo configurado no Render
        },
        to: [
          {
            email: email
          }
        ],
        subject: "Código de Verificação - UCP Brasil Play Alpha",
        htmlContent: `
          <div style="background:#080808; color:#fff; padding:24px; font-family:sans-serif; border-radius:12px; border:1px solid #ff2a2a; max-width:400px; margin:0 auto;">
            <h2 style="color:#ff2a2a; text-align:center; margin-bottom:16px;">BRASIL PLAY ALPHA</h2>
            <p style="font-size:0.9rem; color:#ccc;">Recebemos um pedido de registo na UCP com este e-mail.</p>
            <p style="font-size:0.9rem; color:#ccc;">O seu código de verificação de 6 dígitos é:</p>
            <div style="background:rgba(255,42,42,0.1); border:1px solid #ff2a2a; border-radius:8px; padding:12px; text-align:center; margin:20px 0;">
              <span style="font-size:1.8rem; font-weight:bold; color:#ff2a2a; letter-spacing:6px;">${codigoOtp}</span>
            </div>
            <p style="font-size:0.75rem; color:#888; text-align:center; margin-top:16px;">Se não foi você que solicitou, ignore esta mensagem.</p>
          </div>
        `
      })
    });

    const dadosResposta = await respostaBrevo.json();

    if (!respostaBrevo.ok) {
      console.error('Erro retornado pela API da Brevo:', dadosResposta);
      return res.status(500).json({ 
        sucesso: false, 
        mensagem: 'Erro ao enviar e-mail pela API da Brevo.',
        detalhes: dadosResposta 
      });
    }

    return res.json({ sucesso: true, mensagem: 'Código enviado com sucesso!' });

  } catch (erro) {
    console.error('Erro crítico na requisição de envio:', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao tentar enviar o e-mail.' });
  }
});

// Rota para validar o código inserido pelo jogador
app.post('/api/validar-codigo', (req, res) => {
  const { email, codigo } = req.body;

  if (!email || !codigo) {
    return res.status(400).json({ sucesso: false, mensagem: 'Dados incompletos.' });
  }

  if (codigosArmazenados[email] && codigosArmazenados[email] === codigo) {
    return res.json({ sucesso: true, mensagem: 'Código validado com sucesso!' });
  }

  return res.status(400).json({ sucesso: false, mensagem: 'Código inválido ou expirado.' });
});

// Rota de Registo com gravação real no MongoDB Atlas
app.post('/api/register', async (req, res) => {
  const { email, pass, codigo, nick } = req.body;

  if (!email || !pass || !codigo) {
    return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos obrigatórios.' });
  }

  // Verificar se o código OTP coincide
  if (!codigosArmazenados[email] || codigosArmazenados[email] !== codigo) {
    return res.status(400).json({ sucesso: false, mensagem: 'Código de verificação inválido ou expirado.' });
  }

  try {
    // Verificar se já existe uma conta com este e-mail
    const usuarioExistente = await Usuario.findOne({ email });
    if (usuarioExistente) {
      return res.status(400).json({ sucesso: false, mensagem: 'Este e-mail já está registado.' });
    }

    // Criar e guardar o novo utilizador permanentemente no MongoDB Atlas
    const novoUsuario = new Usuario({ email, pass, nick });
    await novoUsuario.save();

    // Apagar o código após o sucesso
    delete codigosArmazenados[email];

    return res.json({ sucesso: true, mensagem: 'Conta criada e guardada com sucesso!' });

  } catch (erro) {
    console.error('Erro ao guardar o utilizador na base de dados:', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao criar a conta.' });
  }
});

// Rota de Login
app.post('/api/login', async (req, res) => {
  const { email, pass } = req.body;

  if (!email || !pass) {
    return res.status(400).json({ sucesso: false, mensagem: 'Preencha o e-mail e a palavra-passe.' });
  }

  try {
    // Procurar o utilizador na base de dados
    const usuario = await Usuario.findOne({ email, pass });
    if (!usuario) {
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail ou palavra-passe incorretos.' });
    }

    return res.json({
      sucesso: true,
      mensagem: 'Login efetuado com sucesso!',
      usuario: {
        nick: usuario.nick || email.split('@')[0],
        id: usuario._id,
        dinheiro: 1500000,
        banco: 15420000,
        level: 65,
        organizacao: 'Civil / Nenhum'
      }
    });
  } catch (erro) {
    console.error('Erro no login:', erro);
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao efetuar login.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
