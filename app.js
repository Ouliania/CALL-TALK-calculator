/**
 * CALL-TALK ROI & PAYBACK CALCULATOR
 * Clean, client-facing presentation logic
 * 
 * Rules strictly followed:
 * - NO ruble graphic sign: always "руб." or "руб./мес".
 * - Only use "база контактов" or "база в обработке".
 * - No daily letter limits.
 * - Standard margin: 10–12% (maximum 15%) to avoid overstating payback.
 * - No internal pricing pills visible to client.
 * - Dynamic mailboxes (10 / 20 / 30) scale leads 1x, 2x, 3x.
 * - Monthly plan at the top, followed immediately by payback metrics.
 */

// Formatters
const fmt = {
  num: (val) => new Intl.NumberFormat('ru-RU').format(Math.round(val)),
  rub: (val) => `${fmt.num(val)} руб.`,
  rubPerMonth: (val) => `${fmt.num(val)} руб./мес`,
  pct: (val) => `${val > 0 ? '+' : ''}${Math.round(val)}%`,
  cleanNum: (str) => {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    let s = str.toString().trim().toLowerCase().replace(',', '.');
    // Millions: млн, mln, m, м
    const mlnMatch = s.match(/^([\d.]+)\s*(?:млн|mln|m|м)(?:$|[^\p{L}\p{N}]|\s*руб)/iu);
    if (mlnMatch) {
      const num = parseFloat(mlnMatch[1]);
      if (!isNaN(num)) return Math.round(num * 1000000);
    }
    // Thousands: тыс, тыщ, k, к, т
    const thMatch = s.match(/^([\d.]+)\s*(?:тыс|тыщ|k|к|т)(?:$|[^\p{L}\p{N}]|\s*руб)/iu);
    if (thMatch) {
      const num = parseFloat(thMatch[1]);
      if (!isNaN(num)) return Math.round(num * 1000);
    }
    return parseInt(s.replace(/\D/g, ''), 10) || 0;
  }
};

// Application State
const state = {
  tariffMonths: 4,          // 4 or 2
  tariffFixPerMonth: 39000,
  mailboxesCount: 10,       // 10, 20, 30
  leadPrice: 2800,          // manual input
  leadsCount: 78,           // 78 for 4m (10 boxes), 34 for 2m (10 boxes)
  dealCheck: 1000000,       // average deal in rubles
  marginPercent: 12,        // 12% (strictly 10-12%, max 15%)
  conversionPercent: 15,    // 15%
  ltvEnabled: false,
  ltvRepeatDeals: 2
};

// Base tariff benchmarks
const TARIFF_DATA = {
  4: {
    months: 4,
    fixPerMonth: 39000,
    baseLeads: 78,
    monthly: [
      { name: '1-й месяц (запуск и прогрев)', ratio: 11 / 78 },
      { name: '2-й месяц', ratio: 22 / 78 },
      { name: '3-й месяц', ratio: 22 / 78 },
      { name: '4-й месяц', ratio: 23 / 78 }
    ]
  },
  2: {
    months: 2,
    fixPerMonth: 56000,
    baseLeads: 34,
    monthly: [
      { name: '1-й месяц (запуск и прогрев)', ratio: 11 / 34 },
      { name: '2-й месяц', ratio: 23 / 34 }
    ]
  }
};

// DOM Elements
const DOM = {
  // Tariff buttons
  tariff4: document.getElementById('tariff4'),
  tariff2: document.getElementById('tariff2'),

  // Mailbox buttons
  mailboxBtns: document.querySelectorAll('.mailbox-btn'),

  // Leads and Lead Price
  leadPriceInput: document.getElementById('leadPriceInput'),
  leadsCountInput: document.getElementById('leadsCountInput'),

  // Economics
  dealCheckInput: document.getElementById('dealCheckInput'),
  dealCheckSlider: document.getElementById('dealCheckSlider'),
  dealCheckDisplay: document.getElementById('dealCheckDisplay'),
  quickCheckPills: document.querySelectorAll('.pill-btn[data-check]'),

  marginInput: document.getElementById('marginInput'),
  marginSlider: document.getElementById('marginSlider'),
  marginDisplay: document.getElementById('marginDisplay'),
  quickMarginPills: document.querySelectorAll('.pill-margin'),
  marginProfitPerDealNote: document.getElementById('marginProfitPerDealNote'),

  conversionInput: document.getElementById('conversionInput'),
  conversionSlider: document.getElementById('conversionSlider'),
  conversionDisplay: document.getElementById('conversionDisplay'),
  quickConvPills: document.querySelectorAll('.pill-conv'),

  ltvToggle: document.getElementById('ltvToggle'),
  ltvSubpanel: document.getElementById('ltvSubpanel'),
  ltvSlider: document.getElementById('ltvSlider'),
  ltvMultiplierDisplay: document.getElementById('ltvMultiplierDisplay'),
  quickLtvPills: document.querySelectorAll('.pill-ltv'),

  // Monthly Table
  tableBadgePeriod: document.getElementById('tableBadgePeriod'),
  funnelTableBody: document.getElementById('funnelTableBody'),

  // Break-even
  breakevenBigText: document.getElementById('breakevenBigText'),
  beDealsVal: document.getElementById('beDealsVal'),
  beProfitPerDealSub: document.getElementById('beProfitPerDealSub'),
  beConversionVal: document.getElementById('beConversionVal'),
  beConversionSub: document.getElementById('beConversionSub'),
  beLabelBreakEven: document.getElementById('beLabelBreakEven'),
  beLabelProfitDeals: document.getElementById('beLabelProfitDeals'),
  beProgressFillBe: document.getElementById('beProgressFillBe'),
  beProgressFillProfit: document.getElementById('beProgressFillProfit'),
  breakevenExplanationText: document.getElementById('breakevenExplanationText'),

  // Financial Totals
  heroNetProfitVal: document.getElementById('heroNetProfitVal'),
  heroNetProfitSub: document.getElementById('heroNetProfitSub'),
  heroRoiVal: document.getElementById('heroRoiVal'),
  heroRomiMultipleSub: document.getElementById('heroRomiMultipleSub'),
  heroBudgetVal: document.getElementById('heroBudgetVal'),
  heroBudgetBreakdownSub: document.getElementById('heroBudgetBreakdownSub'),

  // Conclusions
  conclusionsList: document.getElementById('conclusionsList'),
  btnCopyConclusions: document.getElementById('btnCopyConclusions'),

  // Actions
  btnCopyOffer: document.getElementById('btnCopyOffer'),
  btnShareLink: document.getElementById('btnShareLink'),
  btnPrint: document.getElementById('btnPrint'),
  toastContainer: document.getElementById('toastContainer')
};

// Initialize Application
function init() {
  loadUrlParams();
  bindEvents();
  render();
}

// Bind Events
function bindEvents() {
  // Tariff selection
  DOM.tariff4.addEventListener('click', () => {
    state.tariffMonths = 4;
    state.tariffFixPerMonth = 39000;
    updateLeadsFromMailboxes();
    render();
  });

  DOM.tariff2.addEventListener('click', () => {
    state.tariffMonths = 2;
    state.tariffFixPerMonth = 56000;
    updateLeadsFromMailboxes();
    render();
  });

  // Mailbox selection (scales leads x1, x2, x3)
  DOM.mailboxBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.mailboxesCount = parseInt(btn.dataset.boxes, 10);
      updateLeadsFromMailboxes();
      render();
    });
  });

  // Lead price input
  DOM.leadPriceInput.addEventListener('input', (e) => {
    const val = fmt.cleanNum(e.target.value);
    if (val > 0) {
      state.leadPrice = Math.max(1, Math.min(val, 1000000));
      render();
    }
  });

  DOM.leadPriceInput.addEventListener('change', (e) => {
    const val = fmt.cleanNum(e.target.value);
    state.leadPrice = Math.max(1, Math.min(val, 1000000));
    render();
  });

  DOM.leadPriceInput.addEventListener('focus', function() {
    this.select();
  });

  DOM.leadPriceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });

  // Leads count input (manual override)
  DOM.leadsCountInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (val > 0) {
      state.leadsCount = Math.max(1, Math.min(val, 50000));
      render();
    }
  });

  DOM.leadsCountInput.addEventListener('focus', function() {
    this.select();
  });

  DOM.leadsCountInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });

  // Average deal check - SLIDER
  DOM.dealCheckSlider.addEventListener('input', (e) => {
    state.dealCheck = parseInt(e.target.value, 10);
    render();
  });

  // Average deal check - TEXT INPUT (REAL-TIME INPUT FOR ANY CHECK)
  DOM.dealCheckInput.addEventListener('input', (e) => {
    const val = fmt.cleanNum(e.target.value);
    if (val > 0) {
      state.dealCheck = Math.max(1, Math.min(val, 1000000000));
      syncSliderToCheck(state.dealCheck);
      render();
    }
  });

  DOM.dealCheckInput.addEventListener('change', (e) => {
    const val = fmt.cleanNum(e.target.value);
    state.dealCheck = Math.max(1, Math.min(val, 1000000000));
    syncSliderToCheck(state.dealCheck);
    render();
  });

  DOM.dealCheckInput.addEventListener('focus', function() {
    this.select();
  });

  DOM.dealCheckInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });

  DOM.quickCheckPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.dealCheck = parseInt(pill.dataset.check, 10);
      syncSliderToCheck(state.dealCheck);
      render();
    });
  });

  // Margin %
  DOM.marginSlider.addEventListener('input', (e) => {
    state.marginPercent = parseInt(e.target.value, 10);
    render();
  });

  DOM.marginInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (val > 0) {
      state.marginPercent = Math.max(1, Math.min(val, 95));
      render();
    }
  });

  DOM.marginInput.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10) || 12;
    state.marginPercent = Math.max(1, Math.min(val, 95));
    render();
  });

  DOM.marginInput.addEventListener('focus', function() {
    this.select();
  });

  DOM.marginInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });

  DOM.quickMarginPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.marginPercent = parseInt(pill.dataset.margin, 10);
      render();
    });
  });

  // Conversion %
  DOM.conversionSlider.addEventListener('input', (e) => {
    state.conversionPercent = parseInt(e.target.value, 10);
    render();
  });

  DOM.conversionInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (val > 0) {
      state.conversionPercent = Math.max(1, Math.min(val, 95));
      render();
    }
  });

  DOM.conversionInput.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10) || 15;
    state.conversionPercent = Math.max(1, Math.min(val, 95));
    render();
  });

  DOM.conversionInput.addEventListener('focus', function() {
    this.select();
  });

  DOM.conversionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') e.target.blur();
  });

  DOM.quickConvPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.conversionPercent = parseInt(pill.dataset.conv, 10);
      render();
    });
  });

  // LTV
  DOM.ltvToggle.addEventListener('change', (e) => {
    state.ltvEnabled = e.target.checked;
    render();
  });

  DOM.ltvSlider.addEventListener('input', (e) => {
    state.ltvRepeatDeals = parseInt(e.target.value, 10);
    render();
  });

  DOM.quickLtvPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.ltvRepeatDeals = parseInt(pill.dataset.ltv, 10);
      render();
    });
  });

  // Action Buttons
  DOM.btnCopyOffer.addEventListener('click', copyClientSummary);
  DOM.btnShareLink.addEventListener('click', copyShareableLink);
  DOM.btnPrint.addEventListener('click', () => window.print());
  if (DOM.btnCopyConclusions) DOM.btnCopyConclusions.addEventListener('click', copyConclusions);
}

// Calculate leads automatically from mailboxes (10 -> 1x, 20 -> 2x, 30 -> 3x)
function updateLeadsFromMailboxes() {
  const base = state.tariffMonths === 4 ? 78 : 34;
  const mult = state.mailboxesCount / 10;
  state.leadsCount = Math.round(base * mult);
  DOM.leadsCountInput.value = state.leadsCount;
}

// Calculate Metrics
function calculateMetrics() {
  const tariffData = TARIFF_DATA[state.tariffMonths];
  const leadsCount = state.leadsCount;
  const currentLeadPrice = state.leadPrice;

  const ltvFactor = state.ltvEnabled ? (1 + state.ltvRepeatDeals) : 1;

  // Closed deals
  const exactDeals = leadsCount * (state.conversionPercent / 100);
  const dealsCount = Math.max(1, Math.round(exactDeals));

  // Margin per deal (strictly from margin 10-12-15%)
  const marginFrac = state.marginPercent / 100;
  const profitPerDeal = state.dealCheck * marginFrac * ltvFactor;

  // Call-Talk Costs
  const fixTotal = state.tariffMonths * state.tariffFixPerMonth;
  const variableTotal = leadsCount * currentLeadPrice;
  const totalBudget = fixTotal + variableTotal;

  // Break-even
  const exactDealsToBreakEven = profitPerDeal > 0 ? (totalBudget / profitPerDeal) : 0;
  const dealsToBreakEven = Math.max(1, Math.ceil(exactDealsToBreakEven));
  const breakEvenConversion = leadsCount > 0 ? ((exactDealsToBreakEven / leadsCount) * 100).toFixed(1) : '0.0';

  const profitDealsCount = Math.max(0, dealsCount - dealsToBreakEven);

  // Financial totals
  const grossRevenue = dealsCount * state.dealCheck * ltvFactor;
  const grossProfit = dealsCount * profitPerDeal;
  const netProfit = grossProfit - totalBudget;
  const roi = totalBudget > 0 ? Math.round((netProfit / totalBudget) * 100) : 0;
  const romiMultiple = totalBudget > 0 ? (grossProfit / totalBudget).toFixed(1) : '0.0';

  return {
    tariffData,
    currentLeadPrice,
    leadsCount,
    dealsCount,
    profitPerDeal,
    fixTotal,
    variableTotal,
    totalBudget,
    dealsToBreakEven,
    breakEvenConversion,
    profitDealsCount,
    grossRevenue,
    grossProfit,
    netProfit,
    roi,
    romiMultiple
  };
}

// Dynamically synchronize deal check slider with any value
function syncSliderToCheck(val) {
  let min = 0;
  let max = 20000000;
  let step = 10000;

  if (val > 20000000) {
    max = Math.max(50000000, Math.ceil(val * 1.25 / 1000000) * 1000000);
    step = 500000;
  } else if (val < 10000) {
    step = val < 1000 ? 50 : 500;
  }

  DOM.dealCheckSlider.min = min;
  DOM.dealCheckSlider.max = max;
  DOM.dealCheckSlider.step = step;
  DOM.dealCheckSlider.value = val;
}

// Render UI
function render() {
  const m = calculateMetrics();

  // 1. Tariffs
  DOM.tariff4.classList.toggle('active', state.tariffMonths === 4);
  DOM.tariff2.classList.toggle('active', state.tariffMonths === 2);
  DOM.tableBadgePeriod.textContent = `Срок: ${state.tariffMonths} месяца`;

  // 2. Mailboxes
  DOM.mailboxBtns.forEach(btn => {
    const boxes = parseInt(btn.dataset.boxes, 10);
    btn.classList.toggle('active', boxes === state.mailboxesCount);
  });

  // 3. Leads Inputs (only update if not currently typing in them)
  if (document.activeElement !== DOM.leadPriceInput) {
    DOM.leadPriceInput.value = fmt.num(state.leadPrice);
  }
  if (document.activeElement !== DOM.leadsCountInput) {
    DOM.leadsCountInput.value = m.leadsCount;
  }

  // 4. Economics
  DOM.dealCheckDisplay.textContent = fmt.rub(state.dealCheck);
  if (document.activeElement !== DOM.dealCheckInput) {
    DOM.dealCheckInput.value = fmt.num(state.dealCheck);
  }
  syncSliderToCheck(state.dealCheck);

  DOM.quickCheckPills.forEach(pill => {
    const pCheck = parseInt(pill.dataset.check, 10);
    pill.classList.toggle('active', pCheck === state.dealCheck);
  });

  DOM.marginDisplay.textContent = `${state.marginPercent}%`;
  if (document.activeElement !== DOM.marginInput) {
    DOM.marginInput.value = state.marginPercent;
  }
  DOM.marginSlider.value = state.marginPercent;

  DOM.quickMarginPills.forEach(pill => {
    const pMargin = parseInt(pill.dataset.margin, 10);
    pill.classList.toggle('active', pMargin === state.marginPercent);
  });

  DOM.marginProfitPerDealNote.textContent = `Валовая прибыль с 1 сделки: ${fmt.rub(m.profitPerDeal)}`;

  DOM.conversionDisplay.textContent = `${state.conversionPercent}%`;
  if (document.activeElement !== DOM.conversionInput) {
    DOM.conversionInput.value = state.conversionPercent;
  }
  DOM.conversionSlider.value = state.conversionPercent;

  DOM.quickConvPills.forEach(pill => {
    const pConv = parseInt(pill.dataset.conv, 10);
    pill.classList.toggle('active', pConv === state.conversionPercent);
  });

  // LTV
  DOM.ltvToggle.checked = state.ltvEnabled;
  DOM.ltvSubpanel.style.display = state.ltvEnabled ? 'block' : 'none';
  DOM.ltvSlider.value = state.ltvRepeatDeals;
  DOM.ltvMultiplierDisplay.textContent = `+${state.ltvRepeatDeals} ${pluralOrders(state.ltvRepeatDeals)}`;

  DOM.quickLtvPills.forEach(pill => {
    const pLtv = parseInt(pill.dataset.ltv, 10);
    pill.classList.toggle('active', pLtv === state.ltvRepeatDeals);
  });

  // ==================== 1. ТОЧКА БЕЗУБЫТОЧНОСТИ ====================
  DOM.breakevenBigText.innerHTML = `
    Достаточно закрыть <span class="highlight-deals">всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)}</span> из ${m.leadsCount} лидов
  `;
  DOM.beDealsVal.textContent = `${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)}`;
  DOM.beProfitPerDealSub.textContent = `Маржа со сделки: ${fmt.rub(m.profitPerDeal)} (${state.marginPercent}%)`;
  DOM.beConversionVal.textContent = `всего ${m.breakEvenConversion}%`;
  DOM.beConversionSub.textContent = `Окупается, даже если ${Math.round(100 - parseFloat(m.breakEvenConversion))}% лидов не купят`;

  // Scale
  const beRatio = Math.min(100, Math.max(8, Math.round((m.dealsToBreakEven / Math.max(m.dealsCount, m.dealsToBreakEven)) * 100)));
  const profitRatio = Math.max(0, 100 - beRatio);
  DOM.beProgressFillBe.style.width = `${beRatio}%`;
  DOM.beProgressFillProfit.style.width = `${profitRatio}%`;

  DOM.beLabelBreakEven.textContent = `🎯 ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} окупают бюджет (${fmt.rub(m.totalBudget)})`;
  if (m.profitDealsCount > 0) {
    DOM.beLabelProfitDeals.textContent = `💰 Еще ${m.profitDealsCount} ${pluralDeals(m.profitDealsCount)} — чистая прибыль`;
    DOM.beLabelProfitDeals.style.display = 'inline';
  } else {
    DOM.beLabelProfitDeals.textContent = '';
    DOM.beLabelProfitDeals.style.display = 'none';
  }

  DOM.breakevenExplanationText.innerHTML = `
    При среднем чеке <strong>${fmt.rub(state.dealCheck)}</strong> и марже <strong>${state.marginPercent}%</strong> 
    валовая прибыль со сделки составляет <strong>${fmt.rub(m.profitPerDeal)}</strong> 
    Все расходы на проект (<strong>${fmt.rub(m.totalBudget)}</strong>) окупаются с 
    <strong>${m.dealsToBreakEven}-й закрытой сделки</strong>. 
    ${m.profitDealsCount > 0 ? `Оставшиеся <strong>${m.profitDealsCount} ${pluralDeals(m.profitDealsCount)}</strong> первого цикла приносят чистую прибыль.` : `Все последующие закрытые сделки приносят чистую прибыль.`}
  `;

  // ==================== 2. ФИНАНСОВЫЙ ИТОГ (ЧИСТАЯ ПРИБЫЛЬ) ====================
  DOM.heroNetProfitVal.textContent = `${m.netProfit >= 0 ? '+' : ''}${fmt.rub(m.netProfit)}`;
  DOM.heroNetProfitVal.style.color = m.netProfit >= 0 ? 'var(--teal)' : '#DC2626';
  DOM.heroNetProfitSub.textContent = `При конверсии ${state.conversionPercent}% (${m.dealsCount} ${pluralDeals(m.dealsCount)})`;

  DOM.heroRoiVal.textContent = fmt.pct(m.roi);
  DOM.heroRoiVal.style.color = m.roi >= 0 ? 'var(--primary)' : '#DC2626';
  DOM.heroRomiMultipleSub.textContent = `Возврат бюджета в ${m.romiMultiple} раза`;

  DOM.heroBudgetVal.textContent = fmt.rub(m.totalBudget);
  DOM.heroBudgetBreakdownSub.textContent = `${fmt.rub(m.fixTotal)} фикс + ${m.leadsCount} лидов`;

  // ==================== 3. ПОМЕСЯЧНЫЙ ПЛАН (ПОСЛЕ ЧИСТОЙ ПРИБЫЛИ) ====================
  renderMonthlyTable(m);

  // ==================== 4. ВЫВОДЫ (ПО ИЛЬЯХОВУ) ====================
  renderConclusions(m);

  // Sync to URL
  syncStateToUrl();
}

// Pluralization
function pluralDeals(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'сделок';
  if (mod10 === 1) return 'сделка';
  if (mod10 >= 2 && mod10 <= 4) return 'сделки';
  return 'сделок';
}

function pluralOrders(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'заказов';
  if (mod10 === 1) return 'заказ';
  if (mod10 >= 2 && mod10 <= 4) return 'заказа';
  return 'заказов';
}

// Render Monthly Plan Table (4 columns, clean & readable)
function renderMonthlyTable(m) {
  const months = m.tariffData.monthly;
  let html = '';

  let accumLeads = 0;
  let accumDeals = 0;
  let accumCost = 0;

  months.forEach((row, idx) => {
    const isLast = idx === months.length - 1;
    // Calculate leads per month
    let monthLeads = Math.round(m.leadsCount * row.ratio);
    if (isLast) {
      monthLeads = m.leadsCount - accumLeads;
    }
    const monthDeals = Math.max(1, Math.round(monthLeads * (state.conversionPercent / 100)));
    const monthCost = state.tariffFixPerMonth + (monthLeads * m.currentLeadPrice);

    accumLeads += monthLeads;
    accumDeals += monthDeals;
    accumCost += monthCost;

    html += `
      <tr>
        <td><strong>${row.name}</strong></td>
        <td><strong>${monthLeads} лидов</strong></td>
        <td><strong>${monthDeals} ${pluralDeals(monthDeals)}</strong></td>
        <td>${fmt.rub(monthCost)}</td>
      </tr>
    `;
  });

  html += `
    <tr class="total-row">
      <td><strong>ИТОГО ЗА ${state.tariffMonths} МЕСЯЦА</strong></td>
      <td><strong>${accumLeads} лидов</strong></td>
      <td><strong>${accumDeals} ${pluralDeals(accumDeals)}</strong></td>
      <td><strong>${fmt.rub(accumCost)}</strong></td>
    </tr>
  `;

  DOM.funnelTableBody.innerHTML = html;
}

// Render Conclusions (Maxim Ilyakhov Standard: clean, calm, factual)
function renderConclusions(m) {
  DOM.conclusionsList.innerHTML = `
    <div class="conclusion-item">
      <svg class="conclusion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
      <div>
        <strong>Точка безубыточности:</strong> чтобы вернуть 100% бюджета проекта (${fmt.rub(m.totalBudget)}), достаточно закрыть 
        <strong>всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} лидов</strong>. 
        Это конверсия <strong>всего ${m.breakEvenConversion}%</strong>.
      </div>
    </div>

    <div class="conclusion-item">
      <svg class="conclusion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
      <div>
        <strong>Прогноз дохода:</strong> при стандартной конверсии ${state.conversionPercent}% отдел продаж закрывает 
        <strong>${m.dealsCount} ${pluralDeals(m.dealsCount)}</strong>, что дает 
        <strong>${fmt.rub(m.grossRevenue)} выручки</strong> и 
        <strong>+${fmt.rub(m.netProfit)} чистой прибыли</strong> сверх всех затрат (возврат бюджета в ${m.romiMultiple} раза).
      </div>
    </div>

    <div class="conclusion-item">
      <svg class="conclusion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
      <div>
        <strong>Оплата за результат:</strong> фикс покрывает подготовку и инфраструктуру на базе <strong>${state.mailboxesCount} ящиков Яндекс 360</strong>. 
        Лиды оплачиваются только при подтвержденном интересе ЛПР. Отказы и нецелевые контакты — 0 руб.
      </div>
    </div>
  `;
}

// Copy Calculation for Client
function copyClientSummary() {
  const m = calculateMetrics();

  const text = `
Расчет окупаемости Call-Talk:

• Срок договора: ${state.tariffMonths} месяца
• Почтовая инфраструктура: ${state.mailboxesCount} ящиков Яндекс 360
• Прогноз лидов: ${m.leadsCount} лидов с подтвержденным интересом
• Ставка за лид: ${fmt.rub(m.currentLeadPrice)} (отказы и спам — 0 руб.)
• Фикс за инфраструктуру: ${fmt.rubPerMonth(state.tariffFixPerMonth)} (${fmt.rub(m.fixTotal)} за весь срок)
• Общий бюджет проекта: ${fmt.rub(m.totalBudget)}

Точка безубыточности:
При среднем чеке ${fmt.rub(state.dealCheck)} и марже ${state.marginPercent}% валовая прибыль со сделки составляет ${fmt.rub(m.profitPerDeal)}.
Для полной окупаемости проекта достаточно закрыть ВСЕГО ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} лидов (конверсия всего ${m.breakEvenConversion}%).
${m.profitDealsCount > 0 ? `Оставшиеся ${m.profitDealsCount} ${pluralDeals(m.profitDealsCount)} первого цикла приносят чистую прибыль.` : `Все последующие закрытые сделки приносят чистую прибыль.`}

Прогноз при конверсии ${state.conversionPercent}%:
• Закрытых сделок: ${m.dealsCount} ${pluralDeals(m.dealsCount)}
• Привлеченная выручка: ${fmt.rub(m.grossRevenue)}
• Чистая прибыль сверх затрат: +${fmt.rub(m.netProfit)}
• Окупаемость затрат (ROI): ${fmt.pct(m.roi)} (возврат бюджета в ${m.romiMultiple} раза)
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    showToast('Расчет скопирован в буфер обмена!');
  }).catch(() => {
    showToast('Ошибка копирования.');
  });
}

// Copy Conclusions Only
function copyConclusions() {
  const m = calculateMetrics();

  const text = `
Выводы по проекту Call-Talk:

1. Точка безубыточности: для 100% возврата бюджета (${fmt.rub(m.totalBudget)}) достаточно закрыть всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} лидов (конверсия всего ${m.breakEvenConversion}%).
2. Прогноз дохода: при конверсии ${state.conversionPercent}% прогноз дает ${m.dealsCount} ${pluralDeals(m.dealsCount)}, ${fmt.rub(m.grossRevenue)} выручки и +${fmt.rub(m.netProfit)} чистой прибыли сверх затрат.
3. Оплата за результат: фикс покрывает инфраструктуру (${state.mailboxesCount} ящиков Яндекс 360). Лиды оплачиваются только за подтвержденный интерес. Нецелевые ответы — 0 руб.
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    showToast('Выводы скопированы в буфер обмена!');
  }).catch(() => {
    showToast('Ошибка копирования.');
  });
}

// Copy Shareable Link
function copyShareableLink() {
  const url = window.location.origin + window.location.pathname + getQueryString();
  navigator.clipboard.writeText(url).then(() => {
    showToast('Ссылка скопирована!');
  }).catch(() => {
    showToast('Не удалось скопировать ссылку.');
  });
}

// Query String
function getQueryString() {
  const params = new URLSearchParams();
  params.set('m', state.tariffMonths);
  params.set('boxes', state.mailboxesCount);
  params.set('lp', state.leadPrice);
  params.set('lc', state.leadsCount);
  params.set('check', state.dealCheck);
  params.set('margin', state.marginPercent);
  params.set('conv', state.conversionPercent);
  if (state.ltvEnabled) {
    params.set('ltv', '1');
    params.set('rep', state.ltvRepeatDeals);
  }
  return '?' + params.toString();
}

// Sync to URL
function syncStateToUrl() {
  const newUrl = window.location.pathname + getQueryString();
  window.history.replaceState({}, '', newUrl);
}

// Load URL Params
function loadUrlParams() {
  const params = new URLSearchParams(window.location.search);

  if (params.has('m')) {
    const m = parseInt(params.get('m'), 10);
    if (m === 2 || m === 4) {
      state.tariffMonths = m;
      state.tariffFixPerMonth = m === 4 ? 39000 : 56000;
    }
  }

  if (params.has('boxes')) {
    const b = parseInt(params.get('boxes'), 10);
    if ([10, 15, 20, 30].includes(b)) state.mailboxesCount = b;
  }

  if (params.has('lp')) {
    const lp = parseInt(params.get('lp'), 10);
    if (lp >= 1 && lp <= 1000000) state.leadPrice = lp;
  }

  if (params.has('lc')) {
    const lc = parseInt(params.get('lc'), 10);
    if (lc > 0 && lc <= 50000) state.leadsCount = lc;
  }

  if (params.has('check')) {
    const check = parseInt(params.get('check'), 10);
    if (check >= 1 && check <= 1000000000) state.dealCheck = check;
  }

  if (params.has('margin')) {
    const margin = parseInt(params.get('margin'), 10);
    if (margin >= 1 && margin <= 90) state.marginPercent = margin;
  }

  if (params.has('conv')) {
    const conv = parseInt(params.get('conv'), 10);
    if (conv >= 1 && conv <= 60) state.conversionPercent = conv;
  }

  if (params.has('ltv') && params.get('ltv') === '1') {
    state.ltvEnabled = true;
    if (params.has('rep')) {
      const rep = parseInt(params.get('rep'), 10);
      if (rep >= 1 && rep <= 30) state.ltvRepeatDeals = rep;
    }
  }
}

// Toast
function showToast(msg) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 200);
  }, 2500);
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
