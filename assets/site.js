
const instructions={iphone:{guide:'vpn/iphone/',label:'iPhone',app:'Happ для iPhone',url:'https://apps.apple.com/app/happ-proxy-utility/id6504287215',desc:'Установите приложение из App Store.',last:'В кабинете в разделе «Подписка» нажмите «Добавить в Happ» и включите подключение.'},android:{guide:'vpn/android/',label:'Android',app:'Happ для Android',url:'https://www.happ.su/',desc:'Установите клиент с официального сайта.',last:'Добавьте в Happ ссылку подписки, полученную в личном кабинете.'},windows:{app:'Happ для Windows',url:'https://www.happ.su/',desc:'Загрузите совместимую версию клиента.',last:'Импортируйте подписку из личного кабинета в Happ и подключитесь.'},macos:{app:'Happ для macOS',url:'https://www.happ.su/',desc:'Установите подходящую версию клиента.',last:'Добавьте подписку Flowpass в Happ и включите подключение.'},tv:{app:'совместимый клиент для TV',url:'https://t.me/Flowpass_helper_bot',desc:'Уточните совместимость конкретной модели в поддержке.',last:'Добавьте предоставленную конфигурацию в совместимое приложение.'}};
const stepList=document.getElementById('steps-list');document.querySelectorAll('[data-device]').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('[data-device]').forEach(t=>t.setAttribute('aria-selected',String(t===tab)));const d=instructions[tab.dataset.device];const guide=d.guide?`<a class="step-guide" href="${stepList.dataset.baseUrl}${d.guide}">Подробная инструкция для ${d.label} <span aria-hidden="true">↗</span></a>`:'';stepList.innerHTML=`<div class="step"><span class="step-num">01</span><div><strong>Создайте аккаунт</strong><p>Откройте <a href="https://lk.flowpass.online/login">личный кабинет</a> и активируйте пробный доступ.</p></div></div><div class="step"><span class="step-num">02</span><div><strong>Установите ${d.app}</strong><p>${d.desc}</p><a class="step-action" href="${d.url}" target="_blank" rel="noopener noreferrer">Перейти <span aria-hidden="true">↗</span></a></div></div><div class="step"><span class="step-num">03</span><div><strong>Подключитесь</strong><p>${d.last}</p>${guide}</div></div>`}));
document.querySelectorAll('.faqitem button').forEach(btn=>btn.addEventListener('click',()=>{let open=btn.getAttribute('aria-expanded')==='true';btn.setAttribute('aria-expanded',String(!open));btn.querySelector('span').textContent=open?'+':'−';btn.nextElementSibling.hidden=open}));const menu=document.getElementById('menu'),nav=document.getElementById('navlinks');menu.addEventListener('click',()=>{let open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.textContent=open?'×':'☰'});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.textContent='☰'}));


(function(){const board=document.getElementById('flow-board');if(!board)return;const desc={local:'Российские сервисы работают напрямую — без лишнего VPN-маршрута.',vpn:'Зарубежный трафик направляется через VPN-подключение.',ai:'Для некоторых AI-сервисов предусмотрен отдельный вариант подключения.'};board.querySelectorAll('[data-route]').forEach(btn=>btn.addEventListener('click',()=>{board.querySelectorAll('[data-route]').forEach(b=>{b.classList.toggle('active',b===btn);b.setAttribute('aria-pressed',String(b===btn))});document.getElementById('route-explain').textContent=desc[btn.dataset.route]}));})();


(()=>{
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const bar=document.getElementById('scroll-progress');
 let ticking=false;
 const paint=()=>{const max=document.documentElement.scrollHeight-window.innerHeight;bar.style.transform=`scaleX(${max>0?Math.max(0,Math.min(1,window.scrollY/max)):0})`;document.querySelector('.navbar').classList.toggle('scrolled',window.scrollY>20);ticking=false};
 window.addEventListener('scroll',()=>{if(!ticking){requestAnimationFrame(paint);ticking=true}},{passive:true});window.addEventListener('resize',paint,{passive:true});paint();
 if(!reduced && 'IntersectionObserver' in window){
   const targets=document.querySelectorAll('.sectionlead,.step-layout,.price-card,.faq-grid,.cta-box,.signalitem');
   document.body.classList.add('js-motion');
   const io=new IntersectionObserver(items=>{items.forEach(item=>{if(item.isIntersecting){item.target.classList.add('is-visible');io.unobserve(item.target)}})},{threshold:.07,rootMargin:'0px 0px -24px 0px'});
   targets.forEach((el,i)=>{el.classList.add('reveal');el.style.setProperty('--reveal-delay',`${(i%4)*80}ms`);io.observe(el)});
   // A browser supporting scroll timelines animates cards directly with CSS.
   // Older browsers use this observer; the default remains visible if scripts are blocked.
   if(!CSS.supports('animation-timeline: view()')){
     const cards=[...document.querySelectorAll('.benefitgrid .benefit')];
     cards.forEach((card,i)=>{
       card.classList.add('card-entrance');
       card.style.setProperty('--card-delay',`${i*130}ms`);
     });
     const cardObserver=new IntersectionObserver(entries=>{
       entries.forEach(({target,isIntersecting})=>{
         if(!isIntersecting)return;
         target.classList.add('card-visible');
         cardObserver.unobserve(target);
       });
     },{threshold:.1,rootMargin:'0px 0px -30px 0px'});
     cards.forEach(card=>cardObserver.observe(card));
   }
 }
})();
