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
      --header-bg:rgba(255,255,255,.96);
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
      --header-bg:rgba(15,20,29,.96);
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
      box-shadow:0 8px 26px rgba(15,23,42,.08)!important;
      min-height:74px!important;
    }
    :root[data-theme="dark"] .topbar{box-shadow:0 8px 26px rgba(0,0,0,.34)!important}
    .topbar .container{width:min(1480px,96%)!important}
    .topbar-inner{
      display:grid!important;
      grid-template-columns:auto minmax(0,1fr) auto!important;
      grid-template-areas:"brand nav actions"!important;
      align-items:center!important;
      gap:14px!important;
      padding:10px 0!important;
      min-height:74px!important;
    }
    .topbar-inner>.brand{grid-area:brand!important;min-width:180px!important}
    .brand-badge{width:48px!important;height:48px!important;border-radius:14px!important}
    .brand-text{font-size:1.18rem!important}
    .brand-subtitle{font-size:.68rem!important}
    .topbar-inner>.header-nav{
      grid-area:nav!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      flex-direction:row!important;
      flex-wrap:nowrap!important;
      gap:2px!important;
      width:100%!important;
      min-width:0!important;
      overflow-x:auto!important;
      overflow-y:hidden!important;
      scrollbar-width:none!important;
      padding:0!important;
    }
    .topbar-inner>.header-nav::-webkit-scrollbar{display:none!important}
    .header-nav a{
      display:inline-flex!important;
      align-items:center!important;
      justify-content:center!important;
      flex:0 0 auto!important;
      padding:8px 9px!important;
      border-radius:999px!important;
      color:var(--header-link)!important;
      font-size:.78rem!important;
      line-height:1!important;
      white-space:nowrap!important;
      margin:0!important;
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
      gap:7px!important;
      flex-wrap:nowrap!important;
      min-width:0!important;
    }
    .search-form{
      min-width:0!important;
      width:clamp(150px,16vw,230px)!important;
      height:42px!important;
      padding:0 13px!important;
      background:var(--input-bg)!important;
      border:1px solid var(--border)!important;
      box-shadow:none!important;
    }
    .search-form input{color:var(--text)!important;font-size:.82rem!important}
    .cart-btn,.theme-toggle{
      width:42px!important;
      height:42px!important;
      flex:0 0 42px!important;
      display:inline-grid!important;
      place-items:center!important;
      border-radius:12px!important;
      border:1px solid var(--border)!important;
      background:var(--surface)!important;
      color:var(--text)!important;
      box-shadow:none!important;
      cursor:pointer!important;
      font-size:1rem!important;
      transition:transform .18s ease,background .18s ease,border-color .18s ease!important;
      position:relative!important;
      right:auto!important;
      bottom:auto!important;
    }
    .cart-btn{color:#ff6b35!important;background:rgba(255,107,53,.10)!important}
    .theme-toggle:hover,.cart-btn:hover{transform:translateY(-1px)!important;border-color:rgba(255,107,53,.45)!important}
    .auth-group{gap:6px!important;min-width:0!important;display:flex!important;align-items:center!important;flex-wrap:nowrap!important}
    .login-btn,.register-btn,.logout-btn,.username-highlight{
      min-height:40px!important;
      padding:0 12px!important;
      font-size:.78rem!important;
      white-space:nowrap!important;
      box-shadow:none!important;
      max-width:190px!important;
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

    @media(max-width:760px){
      .topbar .container{width:min(100% - 18px,760px)!important}
      .topbar-inner{
        grid-template-columns:auto 1fr!important;
        grid-template-areas:"brand actions" "nav nav"!important;
        gap:8px 10px!important;
        padding:8px 0!important;
      }
      .topbar-inner>.brand{min-width:0!important}
      .brand-copy{display:none!important}
      .topbar-actions{justify-content:flex-end!important;gap:6px!important}
      .search-form{display:none!important}
      .header-nav{justify-content:flex-start!important;padding-bottom:2px!important}
      .header-nav a{font-size:.76rem!important;padding:8px 9px!important}
      .auth-group .username-highlight{max-width:110px!important}
      .login-btn,.register-btn,.logout-btn,.username-highlight{font-size:.75rem!important;padding:0 10px!important}
    }
    @media(max-width:480px){
      .topbar-actions{max-width:calc(100vw - 90px)!important}
      .auth-group .logout-btn{display:none!important}
      .header-nav a{font-size:.72rem!important;padding:7px 8px!important}
      .cart-btn,.theme-toggle{width:38px!important;height:38px!important;flex-basis:38px!important}
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