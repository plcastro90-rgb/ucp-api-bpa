const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// Variáveis temporárias em memória
const codigosArmazenados = {}; // Guarda os códigos OTP temporários
const contasArmazenadas = {};  // Guarda as contas criadas { email: { pass, nick, ... } }

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

  // Verificar se a conta já existe
  if (contasArmazenadas[email]) {
    return res.status(400).json({ sucesso: false, mensagem: 'Este e-mail já está associado a uma conta.' });
  }

  const codigoOtp = Math.floor(100000 + Math.random() * 900000).toString();
  codigosArmazenados[email] = codigoOtp;

  try {
    const respostaBrevo = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.SMTP_PASS
      },
      body: JSON.stringify({
        sender: {
          name: "Brasil Play Alpha",
          email: process.env.SMTP_USER
        },
        to: [{ email: email }],
        subject: "Código de Verificação - UCP Brasil Play Alpha",
        htmlContent: `
          <div style="background:#080808; color:#fff; padding:24px; font-family:sans-serif; border-radius:12px; border:1px solid #ff2a2a; max-width:400px; margin:0 auto;">
            <h2 style="color:#ff2a2a; text-align:center; margin-bottom:16px;">BRASIL PLAY ALPHA</h2>
            <p style="font-size:0.9rem; color:#ccc;">O seu código de verificação de 6 dígitos é:</p>
            <div style="background:rgba(255,42,42,0.1); border:1px solid #ff2a2a; border-radius:8px; padding:12px; text-align:center; margin:20px 0;">
              <span style="font-size:1.8rem; font-weight:bold; color:#ff2a2a; letter-spacing:6px;">${codigoOtp}</span>
            </div>
          </div>
        `
      })
    });

    const dadosResposta = await respostaBrevo.json();

    if (!respostaBrevo.ok) {
      return res.status(500).json({ sucesso: false, mensagem: 'Erro ao enviar e-mail pela Brevo.', detalhes: dadosResposta });
    }

    return res.json({ sucesso: true, mensagem: 'Código enviado com sucesso!' });

  } catch (erro) {
    return res.status(500).json({ sucesso: false, mensagem: 'Erro interno ao tentar enviar o e-mail.' });
  }
});

// Rota de Registo
app.post('/api/register', (req, res) => {
  const { email, pass, codigo, nick } = req.body;

  if (!email || !pass || !codigo) {
    return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos obrigatórios.' });
  }

  if (!codigosArmazenados[email] || codigosArmazenados[email] !== codigo) {
    return res.status(400).json({ sucesso: false, mensagem: 'Código de verificação inválido ou expirado.' });
  }

  if (contasArmazenadas[email]) {
    return res.status(400).json({ sucesso: false, mensagem: 'Esta conta já existe.' });
  }

  // Guardar a conta efetivamente
  contasArmazenadas[email] = {
    pass: pass,
    nick: nick || email.split('@')[0],
    id: Math.floor(1000 + Math.random() * 9000).toString(),
    rg: Math.floor(10000 + Math.random() * 90000).toString(),
    dinheiro: 1500000,
    banco: 15420000,
    level: 1,
    organizacao: 'Civil / Nenhum'
  };

  delete codigosArmazenados[email];

  return res.json({ sucesso: true, mensagem: 'Conta criada com sucesso!' });
});

// Rota de Login (Agora valida se a conta existe e se a palavra-passe está correta)
app.post('/api/login', (req, res) => {
  const { email, pass } = req.body;

  if (!email || !pass) {
    return res.status(400).json({ sucesso: false, mensagem: 'Preencha o e-mail e a palavra-passe.' });
  }

  const conta = contasArmazenadas[email];

  if (!conta) {
    return res.status(400).json({ sucesso: false, mensagem: 'Conta não encontrada. Faça o registo primeiro.' });
  }

  if (conta.pass !== pass) {
    return res.status(400).json({ sucesso: false, mensagem: 'Palavra-passe incorreta.' });
  }

  return res.json({
    sucesso: true,
    mensagem: 'Login efetuado com sucesso!',
    usuario: {
      nick: conta.nick,
      id: conta.id,
      rg: conta.rg,
      dinheiro: conta.dinheiro,
      banco: conta.banco,
      level: conta.level,
      organizacao: conta.organizacao
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
