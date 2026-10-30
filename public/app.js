/**
 * CALL-TALK ROI & PAYBACK CALCULATOR
 * Core Application Logic & State Management
 * 
 * Rules strictly followed:
 * - NO ruble graphic sign: always "руб." or "руб./мес".
 * - Only use "база контактов" or "база в обработке".
 * - No daily letter limits.
 * - Standard margin: 10–12% (maximum 15%) to avoid overstating payback.
 * - No secret pricing tiers or x3 meeting labels visible to client.
 * - Direct manual input of lead price and deal parameters.
 * - Break-even point & payback front and center in crisp light-mode UI.
 * - Dedicated Yandex 360 mailboxes counter (10 / 20 / 30).
 */

// Formatters
const fmt = {
  num: (val) => new Intl.NumberFormat('ru-RU').format(Math.round(val)),
  numFloat: (val, dec = 1) => new Intl.NumberFormat('ru-RU', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(val),
  rub: (val) => `${fmt.num(val)} руб.`,
  rubPerMonth: (val) => `${fmt.num(val)} руб./мес`,
  pct: (val) => `${val > 0 ? '+' : ''}${Math.round(val)}%`,
  cleanNum: (str) => {
    if (typeof str === 'number') return str;
    return parseInt(str.toString().replace(/\D/g, ''), 10) || 0;
  }
};

// Application State
const state = {
  tariffMonths: 4,          // 4 or 2
  tariffFixPerMonth: 39000,
  mailboxesCount: 10,       // 10, 20, 30
  leadPrice: 2800,          // manual input, default 2800
  leadsCount: 78,           // default 78 for 4 months, 34 for 2 months
  userCustomizedLeads: false,
  dealCheck: 1000000,       // 1 000 000 руб.
  marginPercent: 12,        // 12% (strictly 10-12%, max 15%)
  conversionPercent: 15,    // 15%
  ltvEnabled: false,
  ltvRepeatDeals: 2
};

// Benchmarks per tariff
const TARIFF_BENCHMARKS = {
  4: {
    months: 4,
    fixPerMonth: 39000,
    totalBaseContacts: 5100,
    leadsMin: 63,
    leadsMax: 94,
    leadsAvg: 78,
    monthly: [
      { month: 1, name: '1-й месяц (прогрев + запуск)', contacts: 600, emails: 1800, leadsMin: 9, leadsMax: 14, leadsAvg: 11 },
      { month: 2, name: '2-й месяц (масштабирование)', contacts: 1500, emails: 4500, leadsMin: 18, leadsMax: 27, leadsAvg: 22 },
      { month: 3, name: '3-й месяц (основные сегменты)', contacts: 1500, emails: 4500, leadsMin: 18, leadsMax: 27, leadsAvg: 22 },
      { month: 4, name: '4-й месяц (дожим и новые сегменты)', contacts: 1500, emails: 4500, leadsMin: 18, leadsMax: 27, leadsAvg: 23 }
    ]
  },
  2: {
    months: 2,
    fixPerMonth: 56000,
    totalBaseContacts: 2100,
    leadsMin: 27,
    leadsMax: 41,
    leadsAvg: 34,
    monthly: [
      { month: 1, name: '1-й месяц (прогрев + запуск)', contacts: 600, emails: 1800, leadsMin: 9, leadsMax: 14, leadsAvg: 11 },
      { month: 2, name: '2-й месяц (масштабирование)', contacts: 1500, emails: 4500, leadsMin: 18, leadsMax: 27, leadsAvg: 23 }
    ]
  }
};

// Mailboxes benchmarks
const MAILBOX_DETAILS = {
  10: { name: '10 ящиков', capacity: 'до 1 500 конт./мес', yandexCost: 3000, desc: 'Базовый поток (до 1 500 конт./мес)' },
  20: { name: '20 ящиков', capacity: 'до 2 500 конт./мес', yandexCost: 6000, desc: 'Масштабирование (до 2 500 конт./мес)' },
  30: { name: '30 ящиков', capacity: 'до 4 000+ конт./мес', yandexCost: 9000, desc: 'Максимальный охват (до 4 000+ конт./мес)' }
};

// DOM Elements
const DOM = {
  // Tariff buttons
  tariff4: document.getElementById('tariff4'),
  tariff2: document.getElementById('tariff2'),
  labelPeriodSummary: document.getElementById('labelPeriodSummary'),

  // Mailboxes buttons
  mailboxBtns: document.querySelectorAll('.mailbox-btn'),
  labelMailboxesSummary: document.getElementById('labelMailboxesSummary'),

  // Lead price & count
  leadPriceInput: document.getElementById('leadPriceInput'),
  leadPriceDisplay: document.getElementById('leadPriceDisplay'),
  labelLeadPriceSummary: document.getElementById('labelLeadPriceSummary'),
  quickLeadPricePills: document.querySelectorAll('.pill-lead-price'),

  leadsCountInput: document.getElementById('leadsCountInput'),
  leadsCountDisplay: document.getElementById('leadsCountDisplay'),
  leadsCountHint: document.getElementById('leadsCountHint'),

  // Economics inputs & sliders
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

  // Break-even Hero Elements (TOP)
  heroPeriodTag: document.getElementById('heroPeriodTag'),
  breakevenBigText: document.getElementById('breakevenBigText'),
  beTotalLeads: document.getElementById('beTotalLeads'),
  beDealsVal: document.getElementById('beDealsVal'),
  beProfitPerDealSub: document.getElementById('beProfitPerDealSub'),
  beConversionVal: document.getElementById('beConversionVal'),
  beLabelBreakEven: document.getElementById('beLabelBreakEven'),
  beLabelProfitDeals: document.getElementById('beLabelProfitDeals'),
  beProgressFillBe: document.getElementById('beProgressFillBe'),
  beProgressFillProfit: document.getElementById('beProgressFillProfit'),
  breakevenExplanationText: document.getElementById('breakevenExplanationText'),

  // Financial Hero Elements
  heroNetProfitVal: document.getElementById('heroNetProfitVal'),
  heroNetProfitSub: document.getElementById('heroNetProfitSub'),
  heroRoiVal: document.getElementById('heroRoiVal'),
  heroRomiMultipleSub: document.getElementById('heroRomiMultipleSub'),
  heroBudgetVal: document.getElementById('heroBudgetVal'),
  heroBudgetBreakdownSub: document.getElementById('heroBudgetBreakdownSub'),

  // Conclusions
  conclusionsList: document.getElementById('conclusionsList'),
  btnCopyConclusions: document.getElementById('btnCopyConclusions'),

  // Secondary Metrics Boxes (BELOW)
  statRevenueVal: document.getElementById('statRevenueVal'),
  statCostShareVal: document.getElementById('statCostShareVal'),
  statDealsVal: document.getElementById('statDealsVal'),
  statDealsProfit: document.getElementById('statDealsProfit'),
  statLeadsVal: document.getElementById('statLeadsVal'),
  statLeadsRange: document.getElementById('statLeadsRange'),
  statCacVal: document.getElementById('statCacVal'),
  statCacCompare: document.getElementById('statCacCompare'),

  // Monthly Table
  tableBadgePeriod: document.getElementById('tableBadgePeriod'),
  funnelTableBody: document.getElementById('funnelTableBody'),

  // Header Actions
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

// Bind User Interactions
function bindEvents() {
  // Tariff selection
  DOM.tariff4.addEventListener('click', () => {
    state.tariffMonths = 4;
    state.tariffFixPerMonth = 39000;
    if (!state.userCustomizedLeads) {
      state.leadsCount = TARIFF_BENCHMARKS[4].leadsAvg;
    }
    render();
  });

  DOM.tariff2.addEventListener('click', () => {
    state.tariffMonths = 2;
    state.tariffFixPerMonth = 56000;
    if (!state.userCustomizedLeads) {
      state.leadsCount = TARIFF_BENCHMARKS[2].leadsAvg;
    }
    render();
  });

  // Mailboxes selection (10 / 20 / 30)
  DOM.mailboxBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.mailboxesCount = parseInt(btn.dataset.boxes, 10);
      render();
    });
  });

  // Lead price input & pills
  DOM.leadPriceInput.addEventListener('change', (e) => {
    const val = fmt.cleanNum(e.target.value);
    state.leadPrice = Math.max(500, Math.min(val, 50000));
    render();
  });

  DOM.quickLeadPricePills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.leadPrice = parseInt(pill.dataset.price, 10);
      render();
    });
  });

  // Leads count input
  DOM.leadsCountInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    if (val > 0) {
      state.leadsCount = val;
      state.userCustomizedLeads = true;
    }
    render();
  });

  // Average Deal Check Input & Slider
  DOM.dealCheckSlider.addEventListener('input', (e) => {
    state.dealCheck = parseInt(e.target.value, 10);
    render();
  });

  DOM.dealCheckInput.addEventListener('change', (e) => {
    const val = fmt.cleanNum(e.target.value);
    state.dealCheck = Math.max(50000, Math.min(val, 100000000));
    render();
  });

  DOM.quickCheckPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.dealCheck = parseInt(pill.dataset.check, 10);
      render();
    });
  });

  // Margin % (STRICTLY 10-12%, MAX 15%)
  DOM.marginSlider.addEventListener('input', (e) => {
    state.marginPercent = parseInt(e.target.value, 10);
    render();
  });

  DOM.marginInput.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10) || 12;
    state.marginPercent = Math.max(1, Math.min(val, 95));
    render();
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

  DOM.conversionInput.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10) || 15;
    state.conversionPercent = Math.max(1, Math.min(val, 95));
    render();
  });

  DOM.quickConvPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.conversionPercent = parseInt(pill.dataset.conv, 10);
      render();
    });
  });

  // LTV Toggle & Slider
  DOM.ltvToggle.addEventListener('change', (e) => {
    state.ltvEnabled = e.target.checked;
    render();
  });

  DOM.ltvSlider.addEventListener('input', (e) => {
    state.ltvRepeatDeals = parseInt(e.target.value, 10);
    render();
  });

  // Action Buttons
  DOM.btnCopyOffer.addEventListener('click', copyClientSummary);
  DOM.btnShareLink.addEventListener('click', copyShareableLink);
  DOM.btnPrint.addEventListener('click', () => window.print());
  if (DOM.btnCopyConclusions) DOM.btnCopyConclusions.addEventListener('click', copyConclusions);
}

// Calculate All Metrics with Margin 10-12% (max 15%)
function calculateMetrics() {
  const tariffData = TARIFF_BENCHMARKS[state.tariffMonths];
  const mailboxInfo = MAILBOX_DETAILS[state.mailboxesCount] || MAILBOX_DETAILS[10];

  const leadsCount = state.leadsCount || tariffData.leadsAvg;
  const currentLeadPrice = state.leadPrice;

  // Repeat deals multiplier
  const ltvFactor = state.ltvEnabled ? (1 + state.ltvRepeatDeals) : 1;

  // Closed deals forecast
  const exactDeals = leadsCount * (state.conversionPercent / 100);
  const dealsCount = Math.max(1, Math.round(exactDeals));

  // Gross Margin per Deal (strictly with margin 10-12-15%)
  const marginFrac = state.marginPercent / 100;
  const profitPerDeal = state.dealCheck * marginFrac * ltvFactor;

  // Call-Talk Costs
  const fixTotal = state.tariffMonths * state.tariffFixPerMonth;
  const variableTotal = leadsCount * currentLeadPrice;
  const totalBudget = fixTotal + variableTotal;

  // Break-even (Точка безубыточности договора)
  // How many deals needed to cover the total budget?
  const exactDealsToBreakEven = profitPerDeal > 0 ? (totalBudget / profitPerDeal) : 0;
  const dealsToBreakEven = Math.max(1, Math.ceil(exactDealsToBreakEven));
  const breakEvenConversion = leadsCount > 0 ? ((exactDealsToBreakEven / leadsCount) * 100).toFixed(1) : '0.0';

  // Profitable deals beyond break-even
  const profitDealsCount = Math.max(0, dealsCount - dealsToBreakEven);

  // Financial totals
  const grossRevenue = dealsCount * state.dealCheck * ltvFactor;
  const grossProfit = dealsCount * profitPerDeal; // total margin generated
  const netProfit = grossProfit - totalBudget;
  const roi = totalBudget > 0 ? Math.round((netProfit / totalBudget) * 100) : 0;
  const romiMultiple = totalBudget > 0 ? (grossProfit / totalBudget).toFixed(1) : '0.0';
  const costShare = grossRevenue > 0 ? ((totalBudget / grossRevenue) * 100).toFixed(1) : '0.0';
  const cac = dealsCount > 0 ? Math.round(totalBudget / dealsCount) : totalBudget;

  return {
    tariffData,
    mailboxInfo,
    currentLeadPrice,
    leadsCount,
    dealsCount,
    exactDeals,
    ltvFactor,
    profitPerDeal,
    fixTotal,
    variableTotal,
    totalBudget,
    exactDealsToBreakEven,
    dealsToBreakEven,
    breakEvenConversion,
    profitDealsCount,
    grossRevenue,
    grossProfit,
    netProfit,
    roi,
    romiMultiple,
    costShare,
    cac
  };
}

// Render UI Components
function render() {
  const m = calculateMetrics();

  // 1. Tariffs
  DOM.tariff4.classList.toggle('active', state.tariffMonths === 4);
  DOM.tariff2.classList.toggle('active', state.tariffMonths === 2);
  DOM.labelPeriodSummary.textContent = `${state.tariffMonths} месяца · ${fmt.num(m.tariffData.totalBaseContacts)} контактов`;
  DOM.tableBadgePeriod.textContent = `Период: ${state.tariffMonths} мес (${fmt.num(m.tariffData.totalBaseContacts)} контактов)`;
  DOM.heroPeriodTag.textContent = `Договор на ${state.tariffMonths} месяца`;

  // 2. Mailboxes
  DOM.mailboxBtns.forEach(btn => {
    const boxes = parseInt(btn.dataset.boxes, 10);
    btn.classList.toggle('active', boxes === state.mailboxesCount);
  });
  DOM.labelMailboxesSummary.textContent = `${m.mailboxInfo.desc}`;

  // 3. Lead Price & Count
  DOM.leadPriceInput.value = fmt.num(state.leadPrice);
  DOM.leadPriceDisplay.textContent = `${fmt.num(state.leadPrice)} руб.`;
  DOM.labelLeadPriceSummary = `${fmt.num(state.leadPrice)} руб. / лид`;

  DOM.quickLeadPricePills.forEach(pill => {
    const p = parseInt(pill.dataset.price, 10);
    pill.classList.toggle('active', p === state.leadPrice);
  });

  DOM.leadsCountInput.value = m.leadsCount;
  DOM.leadsCountDisplay.textContent = `${m.leadsCount} лидов`;
  DOM.leadsCountHint.textContent = state.userCustomizedLeads
    ? `Задано вручную: ${m.leadsCount} лидов за ${state.tariffMonths} мес.`
    : `По умолчанию: прогноз тарифа (${m.tariffData.leadsMin}–${m.tariffData.leadsMax} лида). Можно скорректировать под задачу.`;

  // 4. Client Economics
  DOM.dealCheckDisplay.textContent = fmt.rub(state.dealCheck);
  DOM.dealCheckInput.value = fmt.num(state.dealCheck);
  DOM.dealCheckSlider.value = state.dealCheck;

  DOM.quickCheckPills.forEach(pill => {
    const pCheck = parseInt(pill.dataset.check, 10);
    pill.classList.toggle('active', pCheck === state.dealCheck);
  });

  DOM.marginDisplay.textContent = `${state.marginPercent}%`;
  DOM.marginInput.value = state.marginPercent;
  DOM.marginSlider.value = state.marginPercent;

  DOM.quickMarginPills.forEach(pill => {
    const pMargin = parseInt(pill.dataset.margin, 10);
    pill.classList.toggle('active', pMargin === state.marginPercent);
  });

  DOM.marginProfitPerDealNote.innerHTML = `
    <strong>Валовая прибыль с 1 сделки: ${fmt.rub(m.profitPerDeal)}</strong>. 
    Закладываем маржу 10–12% (макс. 15%), чтобы расчет был честным и окупаемость не завышалась.
  `;

  DOM.conversionDisplay.textContent = `${state.conversionPercent}%`;
  DOM.conversionInput.value = state.conversionPercent;
  DOM.conversionSlider.value = state.conversionPercent;

  DOM.quickConvPills.forEach(pill => {
    const pConv = parseInt(pill.dataset.conv, 10);
    pill.classList.toggle('active', pConv === state.conversionPercent);
  });

  // LTV Toggle & Display
  DOM.ltvToggle.checked = state.ltvEnabled;
  DOM.ltvSubpanel.style.display = state.ltvEnabled ? 'block' : 'none';
  DOM.ltvSlider.value = state.ltvRepeatDeals;
  DOM.ltvMultiplierDisplay.textContent = `+${state.ltvRepeatDeals} ${pluralDeals(state.ltvRepeatDeals)} в год`;

  // ==================== 5. TOP PAYBACK HERO (СВЕТЛЫЙ ДИЗАЙН) ====================
  DOM.beTotalLeads.textContent = m.leadsCount;
  DOM.breakevenBigText.innerHTML = `
    Достаточно закрыть <span class="highlight-deals">всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)}</span> из ${m.leadsCount} лидов
  `;
  DOM.beDealsVal.textContent = `${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)}`;
  DOM.beProfitPerDealSub.textContent = `Маржа со сделки: ${fmt.rub(m.profitPerDeal)} (${state.marginPercent}%)`;
  DOM.beConversionVal.textContent = `всего ${m.breakEvenConversion}%`;

  // Progress Bar: Break-even vs Profit Deals
  const beRatio = Math.min(100, Math.max(8, Math.round((m.dealsToBreakEven / Math.max(m.dealsCount, m.dealsToBreakEven)) * 100)));
  const profitRatio = Math.max(0, 100 - beRatio);
  DOM.beProgressFillBe.style.width = `${beRatio}%`;
  DOM.beProgressFillProfit.style.width = `${profitRatio}%`;

  DOM.beLabelBreakEven.textContent = `🎯 ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} покрывают весь бюджет (${fmt.rub(m.totalBudget)})`;
  if (m.profitDealsCount > 0) {
    DOM.beLabelProfitDeals.textContent = `💰 Еще ${m.profitDealsCount} ${pluralDeals(m.profitDealsCount)} — чистая прибыль`;
    DOM.beLabelProfitDeals.style.display = 'inline';
  } else {
    DOM.beLabelProfitDeals.textContent = ``;
    DOM.beLabelProfitDeals.style.display = 'none';
  }

  DOM.breakevenExplanationText.innerHTML = `
    При среднем чеке <strong>${fmt.rub(state.dealCheck)}</strong> и чистой марже <strong>${state.marginPercent}%</strong> 
    валовая прибыль с одной сделки составляет <strong>${fmt.rub(m.profitPerDeal)}</strong>. 
    Весь ${state.tariffMonths}-месячный бюджет проекта (<strong>${fmt.rub(m.totalBudget)}</strong>) окупается уже с 
    <strong>${m.dealsToBreakEven}-й закрытой сделки</strong>. 
    ${m.profitDealsCount > 0 ? `Оставшиеся <strong>${m.profitDealsCount} ${pluralDeals(m.profitDealsCount)}</strong> первого цикла приносят чистую прибыль сверх расходов на запуск.` : `Все последующие закрытые сделки и повторные заказы приносят 100% чистую прибыль.`}
  `;

  // ==================== 6. FINANCIAL TOTALS ====================
  DOM.heroNetProfitVal.textContent = `${m.netProfit >= 0 ? '+' : ''}${fmt.rub(m.netProfit)}`;
  DOM.heroNetProfitVal.style.color = m.netProfit >= 0 ? 'var(--teal)' : '#DC2626';
  DOM.heroNetProfitSub.textContent = `При конверсии ${state.conversionPercent}% (${m.dealsCount} ${pluralDeals(m.dealsCount)})`;

  DOM.heroRoiVal.textContent = fmt.pct(m.roi);
  DOM.heroRoiVal.style.color = m.roi >= 0 ? 'var(--primary)' : '#DC2626';
  DOM.heroRomiMultipleSub.textContent = `Возврат бюджета в ${m.romiMultiple} раза`;

  DOM.heroBudgetVal.textContent = fmt.rub(m.totalBudget);
  DOM.heroBudgetBreakdownSub.textContent = `${fmt.rub(m.fixTotal)} фикс + ${m.leadsCount} лидов`;

  // ==================== 7. CONCLUSIONS (ВЫВОДЫ ПО ОКУПАЕМОСТИ) ====================
  renderConclusions(m);

  // ==================== 8. SECONDARY METRICS (BELOW) ====================
  DOM.statRevenueVal.textContent = fmt.rub(m.grossRevenue);
  DOM.statCostShareVal.textContent = `Доля затрат в обороте: ~${m.costShare}%`;

  DOM.statDealsVal.textContent = `${m.dealsCount} ${pluralDeals(m.dealsCount)}`;
  DOM.statDealsProfit.textContent = `Маржа со сделки: ${fmt.rub(m.profitPerDeal)}`;

  DOM.statLeadsVal.textContent = `${m.leadsCount} лидов`;
  DOM.statLeadsRange.textContent = state.userCustomizedLeads
    ? `Ручной ввод: ${m.leadsCount} лидов`
    : `Диапазон тарифа: ${m.tariffData.leadsMin}–${m.tariffData.leadsMax} лидов`;

  DOM.statCacVal.textContent = fmt.rub(m.cac);
  DOM.statCacCompare.textContent = `Приносит выручки: ${fmt.rub(state.dealCheck * m.ltvFactor)}`;

  // ==================== 9. MONTHLY TIMELINE TABLE ====================
  renderMonthlyTable(m);

  // Sync state to URL
  syncStateToUrl();
}

// Pluralization helper for deals
function pluralDeals(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'сделок';
  if (mod10 === 1) return 'сделка';
  if (mod10 >= 2 && mod10 <= 4) return 'сделки';
  return 'сделок';
}

// Render Conclusions List
function renderConclusions(m) {
  DOM.conclusionsList.innerHTML = `
    <div class="conclusion-item">
      <svg class="conclusion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
      <div>
        <strong>Минимальный порог риска (точка окупаемости):</strong> 
        Чтобы полностью вернуть 100% затрат на проект (${fmt.rub(m.totalBudget)}), отделу продаж достаточно закрыть 
        <strong>всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} переданных лидов</strong>. 
        Это конверсия <strong>всего ${m.breakEvenConversion}%</strong> — проект окупается, даже если 95%+ лидов не совершат сделку в первый цикл.
      </div>
    </div>

    <div class="conclusion-item">
      <svg class="conclusion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
      <div>
        <strong>Финансовый результат при конверсии ${state.conversionPercent}%:</strong> 
        При стандартных продажах в B2B закрывается <strong>${m.dealsCount} ${pluralDeals(m.dealsCount)}</strong>, что приносит компании 
        <strong>${fmt.rub(m.grossRevenue)} привлеченной выручки</strong> и 
        <strong>+${fmt.rub(m.netProfit)} чистой прибыли</strong> сверх всех расходов на Call-Talk (возврат бюджета в ${m.romiMultiple} раза).
      </div>
    </div>

    <div class="conclusion-item">
      <svg class="conclusion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
      <div>
        <strong>Инфраструктура и защита бюджета:</strong> 
        Холодная инфраструктура разворачивается на базе <strong>${state.mailboxesCount} ящиков Яндекс 360</strong> с защитой вашего основного сайта. 
        Адресная база (${fmt.num(m.tariffData.totalBaseContacts)} контактов) валидируется вручную. 
        Оплата лидов идет строго за подтвержденный интерес ЛПР. Нецелевые ответы и спам — 0 руб.
      </div>
    </div>
  `;
}

// Render Monthly Timeline Table
function renderMonthlyTable(m) {
  const months = m.tariffData.monthly;
  let html = '';

  let accumContacts = 0;
  let accumEmails = 0;
  let accumLeads = 0;
  let accumDeals = 0;
  let accumCost = 0;

  months.forEach((row, idx) => {
    const monthRatio = row.leadsAvg / m.tariffData.leadsAvg;
    const monthLeads = Math.round(m.leadsCount * monthRatio);
    const monthDeals = Math.max(1, Math.round(monthLeads * (state.conversionPercent / 100)));
    const monthCost = state.tariffFixPerMonth + (monthLeads * m.currentLeadPrice);

    accumContacts += row.contacts;
    accumEmails += row.emails;
    accumLeads += monthLeads;
    accumDeals += monthDeals;
    accumCost += monthCost;

    html += `
      <tr>
        <td><strong>${row.name}</strong></td>
        <td>${fmt.num(row.contacts)}</td>
        <td>${fmt.num(row.emails)}</td>
        <td><strong>${monthLeads}</strong> <span style="color:var(--text-muted); font-size:11px;">(${row.leadsMin}–${row.leadsMax})</span></td>
        <td><strong>${monthDeals}</strong></td>
        <td>${fmt.rub(monthCost)}</td>
      </tr>
    `;
  });

  html += `
    <tr class="total-row">
      <td><strong>ИТОГО ЗА ${state.tariffMonths} МЕСЯЦА</strong></td>
      <td><strong>${fmt.num(accumContacts)}</strong></td>
      <td><strong>${fmt.num(accumEmails)}</strong></td>
      <td><strong>${accumLeads} лидов</strong></td>
      <td><strong>${accumDeals} ${pluralDeals(accumDeals)}</strong></td>
      <td><strong>${fmt.rub(accumCost)}</strong></td>
    </tr>
  `;

  DOM.funnelTableBody.innerHTML = html;
}

// Copy Structured Client Calculation for Telegram / WhatsApp
function copyClientSummary() {
  const m = calculateMetrics();

  const text = `
🎯 Расчет окупаемости проекта Call-Talk:

• Срок договора: ${state.tariffMonths} месяца
• База в обработке: ${fmt.num(m.tariffData.totalBaseContacts)} целевых контактов
• Почтовая инфраструктура: ${state.mailboxesCount} ящиков Яндекс 360
• Ставка за лид: ${fmt.rub(m.currentLeadPrice)} (отказы и спам не оплачиваются)
• Прогноз лидов: ${m.leadsCount} лидов с подтвержденным интересом
• Фикс за инфраструктуру: ${fmt.rubPerMonth(state.tariffFixPerMonth)} (${fmt.rub(m.fixTotal)} за весь период)
• Общие инвестиции: ${fmt.rub(m.totalBudget)} (фикс + оплата за лиды)

🛡️ ТОЧКА БЕЗУБЫТОЧНОСТИ:
При вашем среднем чеке ${fmt.rub(state.dealCheck)} и чистой марже ${state.marginPercent}% валовая прибыль со сделки составляет ${fmt.rub(m.profitPerDeal)}.
Вам достаточно закрыть ВСЕГО ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} переданных лидов (конверсия всего ${m.breakEvenConversion}%), чтобы полностью вернуть 100% затрат на проект.
${m.profitDealsCount > 0 ? `Оставшиеся ${m.profitDealsCount} ${pluralDeals(m.profitDealsCount)} первого цикла приносят чистую прибыль!` : `Все последующие закрытые сделки генерируют чистую прибыль.`}

💰 Финансовый прогноз при конверсии ${state.conversionPercent}%:
• Прогноз закрытых сделок: ${m.dealsCount} ${pluralDeals(m.dealsCount)}
• Привлеченная выручка: ${fmt.rub(m.grossRevenue)}
• Чистая прибыль сверх затрат: +${fmt.rub(m.netProfit)}
• Окупаемость затрат (ROI): ${fmt.pct(m.roi)} (возврат бюджета в ${m.romiMultiple} раза)
• Доля затрат на маркетинг: всего ~${m.costShare}% от привлеченного оборота
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    showToast('Полный расчет скопирован в буфер обмена!');
  }).catch(() => {
    showToast('Ошибка копирования. Выделите текст вручную.');
  });
}

// Copy Conclusions Only
function copyConclusions() {
  const m = calculateMetrics();

  const text = `
📌 Ключевые выводы по проекту Call-Talk:

1. Точка безубыточности: для 100% возврата бюджета (${fmt.rub(m.totalBudget)}) достаточно закрыть всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} лидов (конверсия всего ${m.breakEvenConversion}%).
2. Финансовый результат: при конверсии ${state.conversionPercent}% прогноз дает ${m.dealsCount} ${pluralDeals(m.dealsCount)}, ${fmt.rub(m.grossRevenue)} выручки и +${fmt.rub(m.netProfit)} чистой прибыли сверх расходов.
3. Безопасность: оплата только за подтвержденный интерес. Отказы и нецелевые контакты — 0 руб. Инфраструктура разворачивается на ${state.mailboxesCount} ящиках Яндекс 360.
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    showToast('Выводы скопированы в буфер обмена!');
  }).catch(() => {
    showToast('Ошибка копирования.');
  });
}

// Copy Shareable Link with State in URL
function copyShareableLink() {
  const url = window.location.origin + window.location.pathname + getQueryString();
  navigator.clipboard.writeText(url).then(() => {
    showToast('Ссылка с текущими параметрами скопирована!');
  }).catch(() => {
    showToast('Не удалось скопировать ссылку.');
  });
}

// Generate URL Query String
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

// Sync State to Browser URL
function syncStateToUrl() {
  const newUrl = window.location.pathname + getQueryString();
  window.history.replaceState({}, '', newUrl);
}

// Load Params from URL
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
    if ([10, 20, 30].includes(b)) state.mailboxesCount = b;
  }

  if (params.has('lp')) {
    const lp = parseInt(params.get('lp'), 10);
    if (lp >= 500 && lp <= 50000) state.leadPrice = lp;
  }

  if (params.has('lc')) {
    const lc = parseInt(params.get('lc'), 10);
    if (lc > 0 && lc <= 1000) {
      state.leadsCount = lc;
      state.userCustomizedLeads = true;
    }
  }

  if (params.has('check')) {
    const check = parseInt(params.get('check'), 10);
    if (check >= 10000 && check <= 100000000) state.dealCheck = check;
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
      if (rep >= 1 && rep <= 10) state.ltvRepeatDeals = rep;
    }
  }
}

// Simple Toast Notification
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

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', init);
