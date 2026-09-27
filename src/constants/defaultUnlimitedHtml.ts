/**
 * Modelo HTML padrão para a página explicativa do Plano Ilimitado da Victoria (IA Expert).
 * Esse modelo pode ser totalmente customizado pelo administrador no AdminPanel.
 */
export const DEFAULT_UNLIMITED_INFO_HTML = ` <!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ASK VICTORIA HAYES | Unlimited Private Messages</title>
<meta name="description" content="Unlimited private messages with Victoria Hayes for relationship-focused guidance, questions, conversations, and next-step clarity.">
<style>
:root{
  --bg:#090b12; --panel:#111520; --panel2:#151a27; --text:#f7f4f1;
  --muted:#a7a5ad; --rose:#d98298; --rose2:#a94f68; --gold:#d5b47a;
  --line:rgba(255,255,255,.09); --green:#7fd0a1;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{
  margin:0;background:radial-gradient(circle at 80% 0%,rgba(169,79,104,.16),transparent 28%),var(--bg);
  color:var(--text);font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
  line-height:1.6;-webkit-font-smoothing:antialiased;
}
.container{width:min(1060px,92%);margin:auto}
.hero{padding:76px 0 70px;text-align:center;position:relative;overflow:hidden}
.hero:before{
  content:"";position:absolute;width:520px;height:520px;border-radius:50%;
  border:1px solid rgba(217,130,152,.10);right:-260px;top:-260px;
  box-shadow:0 0 0 80px rgba(217,130,152,.025),0 0 0 160px rgba(217,130,152,.018);
}
.badge{
  display:inline-flex;align-items:center;gap:8px;padding:7px 14px;border-radius:999px;
  border:1px solid rgba(217,130,152,.28);background:rgba(217,130,152,.08);
  color:#e9a8b8;text-transform:uppercase;letter-spacing:.15em;font-size:10px;font-weight:800;
}
h1,h2,h3{font-family:Georgia,"Times New Roman",serif;font-weight:400}
h1{font-size:clamp(45px,7vw,76px);line-height:.98;letter-spacing:-.04em;margin:22px auto 20px;max-width:850px}
h1 span{color:var(--rose)}
.lead{max-width:700px;margin:0 auto 30px;color:var(--muted);font-size:18px}
.cta{
  display:inline-flex;justify-content:center;align-items:center;gap:8px;
  width:min(440px,100%);padding:17px 24px;border-radius:15px;
  color:#fff;background:linear-gradient(135deg,var(--rose2),var(--rose));
  font-size:14px;font-weight:850;letter-spacing:.06em;text-transform:uppercase;
  box-shadow:0 14px 35px rgba(169,79,104,.28);transition:.2s;
}
.cta:hover{transform:translateY(-2px);filter:brightness(1.06)}
.micro{font-size:11px;color:#77757e;margin-top:12px}
.chat{
  margin:55px auto 0;max-width:650px;text-align:left;padding:22px;
  border:1px solid var(--line);border-radius:24px;background:rgba(17,21,32,.88);
  box-shadow:0 25px 80px rgba(0,0,0,.35);
}
.chat-head{display:flex;align-items:center;gap:12px;padding-bottom:17px;border-bottom:1px solid var(--line)}
.avatar{width:45px;height:45px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,#dca0af,#854255);font-family:Georgia,serif;font-size:20px}
.chat-head strong{font-family:Georgia,serif;font-size:17px}.status{font-size:11px;color:#8e8b94}
.msg{max-width:84%;padding:12px 15px;border-radius:17px;margin-top:14px;font-size:13px}
.msg.user{margin-left:auto;background:#30202a;border:1px solid rgba(217,130,152,.13);border-bottom-right-radius:5px}
.msg.v{background:#191e2a;border:1px solid rgba(255,255,255,.05);border-bottom-left-radius:5px}
section{padding:88px 0}
.dark2{background:#0d1018;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.head{text-align:center;max-width:730px;margin:0 auto 45px}
.kicker{font-size:10px;color:var(--gold);font-weight:800;text-transform:uppercase;letter-spacing:.18em;margin-bottom:12px}
h2{font-size:clamp(34px,5vw,52px);line-height:1.08;margin:0 0 14px}
.head p{color:var(--muted);font-size:16px;margin:0}
.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.card{
  background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));
  border:1px solid var(--line);border-radius:20px;padding:25px;
}
.icon{width:40px;height:40px;border-radius:12px;background:rgba(217,130,152,.10);border:1px solid rgba(217,130,152,.18);display:grid;place-items:center;color:#e8a5b5;margin-bottom:18px;font-family:Georgia,serif}
.card h3{font-size:22px;margin:0 0 8px}.card p{color:var(--muted);font-size:13px;margin:0}
.comparison{
  max-width:800px;margin:auto;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:var(--panel);
}
.comparison-title{padding:20px;text-align:center;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ddd}
.row{display:grid;grid-template-columns:1fr 120px 150px;gap:10px;padding:14px 20px;border-top:1px solid var(--line);font-size:13px;align-items:center}
.row .label{color:#c7c4cb}.limited{color:#77757e;text-align:right}.unlimited{color:var(--green);font-weight:800;text-align:right}
.note{font-size:11px;color:#74727a;text-align:center;margin-top:13px}
.benefits{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;max-width:850px;margin:auto}
.benefit{display:flex;gap:13px;padding:20px;border:1px solid var(--line);border-radius:17px;background:rgba(255,255,255,.025)}
.check{color:var(--green);font-weight:900}.benefit strong{display:block;font-size:14px}.benefit span{display:block;color:var(--muted);font-size:12px;margin-top:3px}
.offer{
  text-align:center;padding:90px 0;background:
  radial-gradient(circle at 50% 0%,rgba(217,130,152,.16),transparent 42%),#0b0e16;
  border-top:1px solid var(--line);
}
.offer h2{max-width:700px;margin:0 auto 14px}.offer p{max-width:650px;margin:0 auto 26px;color:var(--muted)}
.price{
  display:flex;justify-content:center;align-items:baseline;gap:5px;margin:22px 0 24px;
  font-family:Georgia,serif
}.price .amount{font-size:50px}.price .period{color:var(--muted);font-family:Inter,sans-serif;font-size:14px}
.cancel{font-size:11px;color:#77757e;margin-top:12px}
.faq{max-width:820px;margin:auto}
details{border:1px solid var(--line);background:rgba(255,255,255,.025);border-radius:15px;padding:18px 20px;margin:10px 0}
summary{cursor:pointer;font-family:Georgia,serif;font-size:17px}
details p{color:var(--muted);font-size:13px;margin:12px 0 0}
footer{padding:30px 0;text-align:center;border-top:1px solid var(--line);color:#6f6d75;font-size:10px}
@media(max-width:760px){
  .hero{padding:55px 0}.cards{grid-template-columns:1fr}.benefits{grid-template-columns:1fr}
  .row{grid-template-columns:1fr 85px 105px;font-size:12px;padding:13px 14px}
  .chat{margin-top:40px}
}
</style>
</head>
<body>

<header class="hero">
  <div class="container">
    <div class="badge">✦ Private Relationship Guidance</div>
    <h1>ASK <span>VICTORIA HAYES</span></h1>
    <p class="lead">
      Unlimited private messages for the moments when you need clarity about what to say,
      what to do, or what to consider next.
    </p>
    <a class="cta" href="https://pay.hotmart.com/I107779651W?checkoutMode=10" target="_blank" rel="noopener">Get Unlimited Access</a>
    <div class="micro">Private messaging • Ongoing guidance • Cancel anytime</div>

    <div class="chat">
      <div class="chat-head">
        <div class="avatar">V</div>
        <div><strong>Victoria Hayes</strong><div class="status">Psychologist &amp; Relationship Expert</div></div>
      </div>
      <div class="msg user">“He just started messaging me again. I don't know how I should respond.”</div>
      <div class="msg v">“Tell me what he said and what happened before this message. We can look at the situation together before you decide how to respond.”</div>
      <div class="msg user">“What about what I should post right now?”</div>
      <div class="msg v">“Tell me a little about what's happening, and we'll work through the context together.”</div>
    </div>
  </div>
</header>

<section>
  <div class="container">
    <div class="head">
      <div class="kicker">Why Private Messages?</div>
      <h2>Your situation is specific. Your questions should be too.</h2>
      <p>
        Generic relationship advice can only take you so far. Private messaging gives you
        a place to discuss the details of what is actually happening.
      </p>
    </div>
    <div class="cards">
      <article class="card"><div class="icon">∞</div><h3>Unlimited Messages</h3><p>Ask follow-up questions as your situation develops instead of being limited to a single interaction.</p></article>
      <article class="card"><div class="icon">✦</div><h3>Personal Context</h3><p>Share the details, conversations, and circumstances that make your situation different from generic advice.</p></article>
      <article class="card"><div class="icon">↗</div><h3>Ongoing Guidance</h3><p>Return to the conversation when something changes and work through what to consider next.</p></article>
    </div>
  </div>
</section>

<section class="dark2">
  <div class="container">
    <div class="head">
      <div class="kicker">What You Can Ask</div>
      <h2>Support for the moments that matter.</h2>
      <p>Use your private messages to explore the questions that come up in real relationship situations.</p>
    </div>
    <div class="benefits">
      <div class="benefit"><div class="check">✓</div><div><strong>Messages &amp; Conversations</strong><span>Discuss what was said, how to respond, and how to approach difficult conversations.</span></div></div>
      <div class="benefit"><div class="check">✓</div><div><strong>Reconnection</strong><span>Talk through what to consider when someone from your past begins reaching out again.</span></div></div>
      <div class="benefit"><div class="check">✓</div><div><strong>Social Media &amp; Presence</strong><span>Ask about how you are showing up online and how it fits your current situation.</span></div></div>
      <div class="benefit"><div class="check">✓</div><div><strong>Boundaries &amp; Next Steps</strong><span>Explore your options when you're unsure how to move forward.</span></div></div>
      <div class="benefit"><div class="check">✓</div><div><strong>Dating &amp; Reconnection</strong><span>Discuss what to consider before conversations, dates, or important interactions.</span></div></div>
      <div class="benefit"><div class="check">✓</div><div><strong>Follow-Up Questions</strong><span>Keep the conversation going as new information and new questions come up.</span></div></div>
    </div>
  </div>
</section>

<section>
  <div class="container">
    <div class="head">
      <div class="kicker">More Access. Less Guesswork.</div>
      <h2>Go beyond a limited chat experience.</h2>
      <p>If your situation changes, your questions can change with it.</p>
    </div>
    <div class="comparison">
      <div class="comparison-title">Access Comparison</div>
      <div class="row"><div class="label">Message access</div><div class="limited">Limited</div><div class="unlimited">✓ Unlimited</div></div>
      <div class="row"><div class="label">Follow-up questions</div><div class="limited">Restricted</div><div class="unlimited">✓ Included</div></div>
      <div class="row"><div class="label">Ongoing conversation</div><div class="limited">Limited</div><div class="unlimited">✓ Included</div></div>
      <div class="row"><div class="label">Discuss new developments</div><div class="limited">Limited</div><div class="unlimited">✓ Included</div></div>
    </div>
    <div class="note">Access and response availability are subject to the terms of the specific offer purchased.</div>
  </div>
</section>

<section class="offer">
  <div class="container">
    <div class="kicker">Private Access</div>
    <h2>Have a place to ask when you need clarity.</h2>
    <p>
      Get unlimited private messaging access to Victoria Hayes and bring your specific
      relationship questions to the conversation.
    </p>
    <div class="price"><span class="amount">$27</span><span class="period">/ month</span></div>
    <a class="cta" href="https://pay.hotmart.com/I107779651W?checkoutMode=10" target="_blank" rel="noopener">Start Unlimited Private Messages</a>
    <div class="cancel">Cancel anytime.</div>
  </div>
</section>

<section>
  <div class="container faq">
    <div class="head">
      <div class="kicker">FAQ</div>
      <h2>Questions, answered.</h2>
    </div>

    <details><summary>What can I ask Victoria?</summary><p>You can ask about relationship situations, messages, conversations, reconnection, social media, dating, boundaries, and what to consider before taking your next step.</p></details>
    <details><summary>Can I ask follow-up questions?</summary><p>Yes. The purpose of the private messaging experience is to let you continue the conversation as your situation develops.</p></details>
    <details><summary>Is this a course?</summary><p>No. This is a private messaging service rather than a video course. You are purchasing access to ask questions and receive relationship-focused guidance.</p></details>
    <details><summary>What does “unlimited” mean?</summary><p>Unlimited means there is no stated daily message allowance within the purchased subscription.</p></details>
    <details><summary>Can I cancel my subscription?</summary><p>Yes. You can cancel anytime.</p></details>
  </div>
</section>

<footer>
  © 2026 Victoria Hayes Relationship Guidance. All rights reserved.
</footer>

</body>
</html>`;
