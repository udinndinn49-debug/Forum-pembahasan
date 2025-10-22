/******************************
 * Forum BarBar — Supabase Client
 ******************************/
(function(){
  
  // === Konfigurasi Supabase ===
  const SUPABASE_URL = 'https://zisateevmyushnucnwfs.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_-exfRTTm2rD080T-jwesIQ_YaOVKiJp';

  if(SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('Supabase URL/Key belum diatur. Silakan update di dalam <script>.');
    document.getElementById('postsContainer').innerHTML = `
      <div class="post card" style="border-color: var(--danger); background: rgba(239, 68, 68, 0.1);">
        <h3 style="color:var(--danger); margin:0">Koneksi Database Gagal</h3>
        <p style="color:var(--muted)">Konfigurasi Supabase (URL/Key) belum diatur di dalam file HTML.</p>
      </div>`;
    return; 
  }

  // Penting: Pastikan supabase di-load dari CDN di HTML
  const { createClient } = supabase;
  const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  
  // === Akhir Konfigurasi ===

  const CATEGORIES = ["Semua","Matematika","Sains","Bahasa","Sejarah","Lainnya"];
  const LS_THEME = 'forumbarbar_theme_v1';

  // DOM Elements
  // === [BARU] Tambah elemen untuk landing & konten utama ===
  const landingScreen = document.getElementById('landingScreen');
  const enterBtn = document.getElementById('enterBtn');
  const appHeader = document.querySelector('.app-header');
  const appContainer = document.querySelector('.container');
  // === Akhir penambahan elemen ===

  const categoryListEl = document.getElementById('categoryList');
  const popularTagsEl = document.getElementById('popularTags');
  const postsContainer = document.getElementById('postsContainer');
  const postCountEl = document.getElementById('postCount');
  const composeForm = document.getElementById('composeForm');
  const submitPostBtn = document.getElementById('submitPost');
  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  const themeBtn = document.getElementById('themeBtn');
  
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const sidebarMenu = document.getElementById('sidebarMenu');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');

  // State
  let posts = []; 
  let activeCategory = "Semua";
  let activeTag = null;

  // Inisialisasi Aplikasi
  initializeApp();
  
  async function initializeApp() {
    // === [BARU] Logika untuk tombol masuk ===
    enterBtn.addEventListener('click', () => {
      // 1. Buat landing screen menghilang (fade out)
      landingScreen.style.opacity = '0';
      
      // 2. Setelah animasi selesai, sembunyikan total dan tampilkan konten utama
      setTimeout(() => {
        landingScreen.style.display = 'none';
        appHeader.style.display = 'flex'; // Kembalikan display aslinya
        appContainer.style.display = 'grid'; // Kembalikan display aslinya
      }, 400); // 400ms = durasi transisi di CSS
    });
    // === Akhir logika baru ===

    renderCategoryButtons();
    applySavedTheme();
    
    // Setup event listeners
    composeForm.addEventListener('submit', handleSubmit);
    searchInput.addEventListener('input', debounce(() => renderPosts(), 250));
    sortSelect.addEventListener('change', fetchAndRenderPosts);
    themeBtn.addEventListener('click', toggleTheme);
    
    hamburgerBtn.addEventListener('click', openSidebar);
    sidebarCloseBtn.addEventListener('click', closeSidebar);
    sidebarBackdrop.addEventListener('click', closeSidebar);

    await fetchAndRenderPosts();
    
    tryOpenHash();
  }
  
  function openSidebar() {
    sidebarMenu.classList.add('is-open');
    sidebarBackdrop.classList.add('is-open');
  }
  function closeSidebar() {
    sidebarMenu.classList.remove('is-open');
    sidebarBackdrop.classList.remove('is-open');
  }

  async function fetchAndRenderPosts() {
    postsContainer.innerHTML = `<div class="post card muted">Memuat topik dari database...</div>`;
    const ascending = sortSelect.value === 'old';
    
    const { data, error } = await db
      .from('posts')
      .select('*, replies (*)')
      .order('created_at', { ascending: ascending });

    if(error) {
      console.error('Error fetching posts:', error.message);
      postsContainer.innerHTML = `<div class="post card muted">Gagal memuat data: ${error.message}</div>`;
      return;
    }
    
    posts = data || [];
    renderPosts();
    renderPopularTags();
  }
  
  function normalizeTagText(text){
    return text.replace(/^[#]+/,'').toLowerCase().trim();
  }

  function parseTags(input){
    if(!input) return [];
    return input.split(/[,\\s]+/).map(t => normalizeTagText(t)).filter(Boolean);
  }

  function renderCategoryButtons(){
    categoryListEl.innerHTML = '';
    CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn' + (cat === activeCategory ? ' active' : '');
      btn.textContent = cat;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        activeCategory = cat;
        activeTag = null;
        updateCategoryActiveStates();
        renderPosts(); 
        closeSidebar(); 
      });
      categoryListEl.appendChild(btn);
    });
  }

  function updateCategoryActiveStates(){
    [...categoryListEl.children].forEach(btn => {
      btn.classList.toggle('active', btn.textContent === activeCategory);
    });
  }

  function computePopularTags(){
    const counter = {};
    posts.forEach(p => p.tags.forEach(t => counter[t] = (counter[t]||0)+1));
    return Object.keys(counter).sort((a,b)=>counter[b]-counter[a]).slice(0,12);
  }

  function renderPopularTags(){
    popularTagsEl.innerHTML = '';
    const tags = computePopularTags();
    if(!tags.length){
      popularTagsEl.innerHTML = '<div class="muted">Belum ada tag populer.</div>';
      return;
    }
    tags.forEach(t => {
      const el = document.createElement('div');
      el.className = 'tag-pill';
      el.textContent = '#'+t;
      el.title = 'Filter tag #'+t;
      el.addEventListener('click', () => {
        activeTag = t;
        activeCategory = 'Semua';
        updateCategoryActiveStates();
        renderPosts();
        closeSidebar(); 
      });
      popularTagsEl.appendChild(el);
    });
  }

  function renderPosts(){
    const q = (searchInput.value||'').toLowerCase().trim();
    let list = posts.slice();

    if(activeCategory && activeCategory !== 'Semua'){
      list = list.filter(p => p.category === activeCategory);
    }

    if(activeTag){
      list = list.filter(p => p.tags.includes(activeTag));
    }

    if(q){
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.body.toLowerCase().includes(q) ||
        p.tags.some(t => t.includes(q.replace(/^#/,'')))
      );
    }
    
    postsContainer.innerHTML = '';
    if(!list.length){
      const empty = document.createElement('div');
      empty.className = 'post card';
      empty.innerHTML = '<div class="muted">Belum ada topik yang cocok. Coba buat topik baru atau ubah filter.</div>';
      postsContainer.appendChild(empty);
    } else {
      list.forEach(p => postsContainer.appendChild(renderPostCard(p)));
    }

    postCountEl.textContent = `${list.length} topik`;
  }
  
  function renderReplies(post, container){
    container.innerHTML = '';
    const replies = post.replies || [];
    if(!replies.length) return;

    replies.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    
    replies.forEach(r => {
      const replyEl = document.createElement('div');
      replyEl.className = 'reply-card';
      replyEl.innerHTML = `
        <div class="meta">${formatDate(new Date(r.created_at))}</div>
        <div class="body">${escapeHtml(r.body)}</div>
      `;
      container.appendChild(replyEl);
    });
  }

  function renderPostCard(p){
    const el = document.createElement('article');
    el.className = 'post card';
    el.setAttribute('data-id', p.id);
    const date = new Date(p.created_at);

    el.innerHTML = `
      <div class="meta">
        <div class="cat" aria-hidden="true">${escapeHtml(p.category)}</div>
        <div style="font-size:13px;color:var(--muted)">${formatDate(date)}</div>
      </div>
      <div class="title">${escapeHtml(p.title)}</div>
      <div class="body">${escapeHtml(p.body)}</div>
      <div class="post-tags"></div>
      <div class="replies-section"></div>
      
      <div class="actions">
        <button class="btn ghost shareBtn" title="Salin link topik">Salin Link</button>
        </div>

      <form class="reply-form">
        <textarea name="replyBody" class="input" placeholder="Tulis balasan..." required aria-label="Tulis balasan untuk ${escapeHtml(p.title)}"></textarea>
        <button type="submit" class="btn" style="justify-self:flex-end">Kirim Balasan</button>
      </form>
    `;
    
    const tagsContainer = el.querySelector('.post-tags');
    (p.tags || []).forEach(t => {
      const tEl = document.createElement('div');
      tEl.className = 'tag';
      tEl.textContent = '#'+t;
      tEl.addEventListener('click', () => {
        activeTag = t;
        activeCategory = 'Semua';
        updateCategoryActiveStates();
        renderPosts();
        window.scrollTo({top:0, behavior:'smooth'});
      });
      tagsContainer.appendChild(tEl);
    });

    const repliesContainer = el.querySelector('.replies-section');
    renderReplies(p, repliesContainer);

    el.querySelector('.shareBtn').addEventListener('click', () => {
      const url = new URL(location.href);
      url.hash = p.id;
      navigator.clipboard?.writeText(url.toString()).then(()=> {
        alert('Link topik disalin ke clipboard!');
      }).catch(()=> {
        prompt('Salin link ini:', url.toString());
      });
    });
    
    el.querySelector('.reply-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = e.target;
      const formData = new FormData(form);
      const replyBody = formData.get('replyBody').trim();
      
      if(!replyBody) return alert('Balasan tidak boleh kosong.');
      
      const newReply = { body: replyBody, post_id: p.id };
      
      const { data, error } = await db.from('replies').insert(newReply).select().single();

      if (error) {
        alert('Gagal mengirim balasan: '.trim() + error.message);
      } else {
        p.replies = p.replies || [];
        p.replies.push(data);
        renderReplies(p, repliesContainer);
        form.reset();
      }
    });

    return el;
  }

  async function handleSubmit(event){
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const title = formData.get('title').trim();
    const body = formData.get('body').trim();
    const category = formData.get('category');
    const tags = parseTags(formData.get('tags'));

    if(!title || !body) return alert('Judul dan Isi topik tidak boleh kosong.');
    
    submitPostBtn.disabled = true;
    submitPostBtn.textContent = 'Memposting...';

    const newPost = { title, body, category, tags };
    
    const { error } = await db.from('posts').insert(newPost);

    submitPostBtn.disabled = false;
    submitPostBtn.textContent = 'Posting';

    if(error) {
      alert('Gagal memposting: ' + error.message);
    } else {
      form.reset();
      activeCategory = 'Semua';
      activeTag = null;
      sortSelect.value = 'new';
      updateCategoryActiveStates();
      await fetchAndRenderPosts();
      window.scrollTo({top:0, behavior:'smooth'});
    }
  }

  // Helper & Theme Functions
  function applySavedTheme(){
    const saved = localStorage.getItem(LS_THEME);
    if(saved === 'dark'){
      document.documentElement.setAttribute('data-theme','dark');
      themeBtn.textContent = 'Mode Terang';
      themeBtn.setAttribute('aria-pressed','true');
    } else {
      document.documentElement.removeAttribute('data-theme');
      themeBtn.textContent = 'Mode Gelap';
      themeBtn.setAttribute('aria-pressed','false');
    }
  }

  function toggleTheme(){
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if(isDark){
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem(LS_THEME, 'light');
    } else {
      document.documentElement.setAttribute('data-theme','dark');
      localStorage.setItem(LS_THEME, 'dark');
    }
    applySavedTheme();
  }

  function escapeHtml(text){
    if(!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  function formatDate(d){
    const opts = { day: '2-digit', month: 'short', year: 'numeric', hour:'2-digit', minute:'2-digit' };
    return new Intl.DateTimeFormat('id-ID', opts).format(d);
  }

  function debounce(fn, wait){
    let t;
    return function(...a){
      clearTimeout(t);
      t = setTimeout(()=>fn.apply(this,a), wait);
    }
  }

  function tryOpenHash(){
    const h = location.hash.replace('#','');
    if(!h) return;
    
    const elem = document.querySelector(`[data-id="${h}"]`);
    if(elem){
      elem.scrollIntoView({behavior:'smooth', block:'center'});
      elem.style.transition = 'box-shadow .2s ease, transform .2s ease';
      elem.style.boxShadow = '0 0 0 3px var(--accent)';
      setTimeout(()=> elem.style.boxShadow = '', 2000);
    }
  }
  
  window.ForumBarBar = { posts, db, fetchAndRenderPosts };

})();
