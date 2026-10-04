const express = require('express');
const cors = require('cors');

const app = express();

app.use(express.json());
app.use(cors());

// Variável temporária para guardar os códigos OTP gerados
// Exemplo: { "seuemail@dominio.com": "123456" }
const codigosArmazenados = {};

// Rota de teste para ver se a API está online
app.get('/', (req, res) => {
  res.json({ status: "API do Brasil Play Alpha Online!" });
});

// Rota para enviar o código OTP utilizando a API HTTP da Brevo (Porta 443 - Sem bloqueios)
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
        'api-key': process.env.SMTP_PASS // Utiliza a chave da Brevo configurada no Render
      },
      body: JSON.stringify({
        sender: {
          name: "Brasil Play Alpha",
          email: process.env.SMTP_USER // O seu e-mail verificado na Brevo configurado no Render
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
    delete codigosArmazenados[email]; // Código usado é descartado
    return res.json({ sucesso: true, mensagem: 'Código validado com sucesso!' });
  }

  return res.status(400).json({ sucesso: false, mensagem: 'Código inválido ou expirado.' });
});

// Rota de Registo
app.post('/api/register', (req, res) => {
  const { email, pass, codigo, nick } = req.body;

  if (!email || !pass || !codigo) {
    return res.status(400).json({ sucesso: false, mensagem: 'Preencha todos os campos obrigatórios.' });
  }

  // Verificar se o código OTP coincide
  if (!codigosArmazenados[email] || codigosArmazenados[email] !== codigo) {
    return res.status(400).json({ sucesso: false, mensagem: 'Código de verificação inválido ou expirado.' });
  }

  // Apagar o código após uso bem-sucedido
  delete codigosArmazenados[email];

  return res.json({ sucesso: true, mensagem: 'Conta criada com sucesso!' });
});

// Rota de Login
app.post('/api/login', (req, res) => {
  const { email, pass, servidor } = req.body;

  if (!email || !pass) {
    return res.status(400).json({ sucesso: false, mensagem: 'Preencha o e-mail e a palavra-passe.' });
  }

  return res.json({
    sucesso: true,
    mensagem: 'Login efetuado com sucesso!',
    usuario: {
      nick: email.split('@')[0],
      id: '3492',
      rg: '89120',
      dinheiro: 1500000,
      banco: 15420000,
      level: 65,
      organizacao: 'Civil / Nenhum'
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
