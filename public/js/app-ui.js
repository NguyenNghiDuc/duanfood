(()=>{
  const app=window.__MINI_FOOD_APP||{};
  const token=app.csrfToken||document.querySelector('meta[name="csrf-token"]')?.content||'';
  const nativeFetch=window.fetch.bind(window);
  window.fetch=(input,init={})=>{
    const method=String(init.method||'GET').toUpperCase();
    if(!['GET','HEAD','OPTIONS'].includes(method)){
      const headers=new Headers(init.headers||{});
      if(token&&!headers.has('X-CSRF-Token'))headers.set('X-CSRF-Token',token);
      init={...init,headers};
    }
    return nativeFetch(input,init);
  };

  const root=document.documentElement;
  const saved=localStorage.getItem('mini-food-theme');
  if(saved)root.dataset.theme=saved;
  else root.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';

  const style=document.createElement('style');
  style.id='mini-food-ui-polish';
  style.textContent=`
    :root[data-theme="light"]{
      color-scheme:light;
      --bg:#f8fafc;
      --surface:#ffffff;
      --text:#111827;
      --muted:#64748b;
      --border:#e5e7eb;
      --header-bg:rgba(255,255,255,.94);
      --header-link:#475569;
      --input-bg:#ffffff;
      --soft-bg:#fff7f2;
    }
    :root[data-theme="dark"]{
      color-scheme:dark;
      --bg:#0b0f17;
      --surface:#151a23;
      --text:#f8fafc;
      --muted:#a7b0c0;
      --border:#2b3443;
      --header-bg:rgba(15,20,29,.94);
      --header-link:#d6dce7;
      --input-bg:#111722;
      --soft-bg:#1d222d;
      --shadow:0 18px 45px rgba(0,0,0,.28);
      --shadow-soft:0 10px 24px rgba(0,0,0,.24);
    }
    html,body{transition:background-color .22s ease,color .22s ease}
    body{background:var(--bg)!important;color:var(--text)!important}
    .topbar{
      background:var(--header-bg)!important;
      border-bottom:1px solid var(--border)!important;
      box-shadow:0 10px 30px rgba(15,23,42,.08)!important;
    }
    :root[data-theme="dark"] .topbar{box-shadow:0 10px 30px rgba(0,0,0,.34)!important}
    .topbar-inner{
      display:grid!important;
      grid-template-columns:auto minmax(0,1fr)!important;
      grid-template-areas:"brand actions" "nav nav"!important;
      align-items:center!important;
      gap:10px 24px!important;
      padding:12px 0 10px!important;
    }
    .topbar-inner>.brand{grid-area:brand!important}
    .topbar-inner>.header-nav{
      grid-area:nav!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      flex-wrap:nowrap!important;
      gap:6px!important;
      width:100%!important;
      overflow-x:auto!important;
      scrollbar-width:none;
      padding:2px 0 1px!important;
    }
    .topbar-inner>.header-nav::-webkit-scrollbar{display:none}
    .header-nav a{
      flex:0 0 auto!important;
      padding:8px 12px!important;
      border-radius:999px!important;
      color:var(--header-link)!important;
      font-size:.88rem!important;
      line-height:1!important;
      white-space:nowrap!important;
    }
    .header-nav a:hover,.header-nav a.active{
      color:#ff6b35!important;
      background:rgba(255,107,53,.12)!important;
    }
    .topbar-actions{
      grid-area:actions!important;
      display:flex!important;
      align-items:center!important;
      justify-content:flex-end!important;
      gap:9px!important;
      flex-wrap:nowrap!important;
      min-width:0!important;
    }
    .search-form{
      min-width:0!important;
      width:clamp(180px,22vw,300px)!important;
      height:44px!important;
      padding:0 14px!important;
      background:var(--input-bg)!important;
      border:1px solid var(--border)!important;
      box-shadow:none!important;
    }
    .search-form input{color:var(--text)!important}
    .cart-btn,.theme-toggle{
      width:44px!important;
      height:44px!important;
      flex:0 0 44px!important;
      display:inline-grid!important;
      place-items:center!important;
      border-radius:13px!important;
      border:1px solid var(--border)!important;
      background:var(--surface)!important;
      color:var(--text)!important;
      box-shadow:none!important;
      cursor:pointer!important;
      font-size:1.05rem!important;
      transition:transform .18s ease,background .18s ease,border-color .18s ease!important;
    }
    .cart-btn{color:#ff6b35!important;background:rgba(255,107,53,.10)!important}
    .theme-toggle:hover,.cart-btn:hover{transform:translateY(-1px)!important;border-color:rgba(255,107,53,.45)!important}
    .auth-group{gap:8px!important;min-width:0!important}
    .login-btn,.register-btn,.logout-btn,.username-highlight{
      min-height:42px!important;
      padding:0 14px!important;
      font-size:.86rem!important;
      white-space:nowrap!important;
      box-shadow:none!important;
      max-width:220px!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    .username-highlight{background:linear-gradient(135deg,#16a34a,#22c55e)!important;color:#fff!important}
    :root[data-theme="dark"] .logout-btn{background:#2a1717!important;color:#fecaca!important;border-color:#5b2424!important}
    :root[data-theme="dark"] .card,
    :root[data-theme="dark"] .food-card,
    :root[data-theme="dark"] .feature-card,
    :root[data-theme="dark"] .review-card,
    :root[data-theme="dark"] .news-card,
    :root[data-theme="dark"] .main-nav,
    :root[data-theme="dark"] .hero-grid{background:var(--surface)!important;color:var(--text)!important;border-color:var(--border)!important}
    :root[data-theme="dark"] input,
    :root[data-theme="dark"] textarea,
    :root[data-theme="dark"] select{background:var(--input-bg)!important;color:var(--text)!important;border-color:var(--border)!important}
    :root[data-theme="dark"] .discount-box{background:linear-gradient(135deg,#342315,#211914)!important}
    :root[data-theme="dark"] .discount-box span{color:#d1d5db!important}
    @media(max-width:980px){
      .topbar-inner{grid-template-columns:1fr!important;grid-template-areas:"brand" "actions" "nav"!important;gap:10px!important}
      .topbar-actions{justify-content:flex-start!important;width:100%!important;flex-wrap:wrap!important}
      .search-form{width:min(100%,420px)!important;flex:1 1 260px!important}
      .auth-group{flex:0 1 auto!important}
      .header-nav{justify-content:flex-start!important}
    }
    @media(max-width:620px){
      .topbar-inner{padding:10px 0!important}
      .brand-badge{width:46px!important;height:46px!important;border-radius:14px!important}
      .brand-text{font-size:1.15rem!important}
      .brand-subtitle{display:none!important}
      .topbar-actions{display:grid!important;grid-template-columns:minmax(0,1fr) 44px 44px!important;gap:8px!important}
      .search-form{grid-column:1 / -1!important;width:100%!important;order:2!important}
      .auth-group{grid-column:1 / -1!important;width:100%!important;display:grid!important;grid-template-columns:1fr 1fr!important}
      .auth-group a{max-width:none!important;width:100%!important}
      .header-nav a{font-size:.82rem!important;padding:8px 10px!important}
    }
  `;
  document.head.appendChild(style);

  function syncThemeButton(button){
    const dark=root.dataset.theme==='dark';
    button.textContent=dark?'☀️':'🌙';
    button.title=dark?'Chuyển sang giao diện sáng':'Chuyển sang giao diện tối';
    button.setAttribute('aria-label',button.title);
  }

  document.addEventListener('DOMContentLoaded',()=>{
    const theme=document.createElement('button');
    theme.className='theme-toggle';
    theme.type='button';
    syncThemeButton(theme);
    theme.onclick=()=>{
      const next=root.dataset.theme==='dark'?'light':'dark';
      root.dataset.theme=next;
      localStorage.setItem('mini-food-theme',next);
      syncThemeButton(theme);
    };
    const actions=document.querySelector('.topbar-actions');
    if(actions){
      const auth=actions.querySelector('.auth-group');
      if(auth)actions.insertBefore(theme,auth);else actions.appendChild(theme);
    }else{
      theme.style.position='fixed';
      theme.style.right='18px';
      theme.style.bottom='18px';
      theme.style.zIndex='2000';
      document.body.appendChild(theme);
    }

    const user=app.user;
    if(user){
      const bell=document.createElement('a');
      bell.className='notification-fab';
      bell.href='/notifications';
      bell.innerHTML='🔔 <b style="display:none">0</b>';
      document.body.appendChild(bell);
      const badge=bell.querySelector('b');
      const render=n=>{n=Number(n||0);badge.textContent=n>99?'99+':String(n);badge.style.display=n?'inline-grid':'none'};
      async function poll(){
        try{
          const r=await fetch('/notifications',{headers:{Accept:'application/json'},cache:'no-store'});
          if(!r.ok)return;
          const j=await r.json();
          render(j.unread);
        }catch(_){ }
      }
      if(window.EventSource){
        const source=new EventSource('/notifications/stream');
        source.onmessage=e=>{try{render(JSON.parse(e.data).unread)}catch(_){ }};
        source.onerror=()=>{source.close();poll();setInterval(poll,30000)};
      }else{
        poll();
        setInterval(poll,30000);
      }
    }
    if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  });
})();