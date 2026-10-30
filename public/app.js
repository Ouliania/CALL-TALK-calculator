/**
 * CALL-TALK ROI & PAYBACK CALCULATOR
 * Core Application Logic & State Management
 * 
 * Rules strictly followed:
 * - NO ruble graphic sign: always "руб." or "руб./мес".
 * - Only use "база контактов" or "база в обработке" (NEVER "база ЛПР").
 * - No daily letter limits.
 * - Standard margin: 10–12% (maximum 15%) to avoid overstating payback.
 * - No auto-guessing / auto-suggestions: user numbers entered manually.
 * - Payback & break-even front and center.
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
  tariffMonths: 4,         // 4 or 2
  tariffFixPerMonth: 39000,
  leadType: 'mql',         // 'mql' (interest) or 'sql' (meeting x3)
  nicheLevel: 2,           // 1, 2, or 3
  customLeadPrice: null,   // if manual price per lead is set
  customLeadsCount: null,  // if manual leads count is set
  dealCheck: 1000000,      // average deal in rubles
  marginPercent: 12,       // net margin % (strictly 10-12%, max 15%)
  conversionPercent: 15,   // conversion from lead to deal %
  ltvEnabled: false,       // repeat purchases toggle
  ltvRepeatDeals: 2,       // repeat purchases count
  scenario: 'base'         // 'pessimistic', 'base', 'optimistic'
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
      { month: 3, name: '3-й месяц (основные отрасли)', contacts: 1500, emails: 4500, leadsMin: 18, leadsMax: 27, leadsAvg: 22 },
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

// Base MQL Prices by Level
const LEVEL_MQL_PRICES = {
  1: 1800,
  2: 2800,
  3: 4800
};

// Niche Presets (All margins strictly 10–12%, max 15%)
const PRESETS = {
  metals: {
    name: 'Металлоконструкции',
    tariffMonths: 4,
    leadType: 'mql',
    nicheLevel: 2,
    dealCheck: 2500000,
    marginPercent: 12,
    conversionPercent: 15,
    ltvEnabled: false,
    ltvRepeatDeals: 2
  },
  it: {
    name: 'IT-разработка / SaaS',
    tariffMonths: 4,
    leadType: 'mql',
    nicheLevel: 2,
    dealCheck: 1800000,
    marginPercent: 15,
    conversionPercent: 12,
    ltvEnabled: false,
    ltvRepeatDeals: 2
  },
  packaging: {
    name: 'Опт и поставки',
    tariffMonths: 4,
    leadType: 'mql',
    nicheLevel: 1,
    dealCheck: 600000,
    marginPercent: 12,
    conversionPercent: 15,
    ltvEnabled: true,
    ltvRepeatDeals: 3
  },
  agro: {
    name: 'Спецтехника и станки',
    tariffMonths: 4,
    leadType: 'sql', // Созвоны под ТЗ для крупного чека
    nicheLevel: 3,
    dealCheck: 5000000,
    marginPercent: 10,
    conversionPercent: 25,
    ltvEnabled: false,
    ltvRepeatDeals: 1
  },
  consulting: {
    name: 'Сервис и аудит',
    tariffMonths: 2,
    leadType: 'mql',
    nicheLevel: 2,
    dealCheck: 800000,
    marginPercent: 15,
    conversionPercent: 15,
    ltvEnabled: false,
    ltvRepeatDeals: 2
  }
};

// DOM Elements
const DOM = {
  // Tariff buttons
  tariff4: document.getElementById('tariff4'),
  tariff2: document.getElementById('tariff2'),
  labelPeriodSummary: document.getElementById('labelPeriodSummary'),

  // Lead format buttons
  leadTypeMQL: document.getElementById('leadTypeMQL'),
  leadTypeSQL: document.getElementById('leadTypeSQL'),
  labelLeadFormatNote: document.getElementById('labelLeadFormatNote'),
  mqlPriceText: document.getElementById('mqlPriceText'),
  sqlPriceText: document.getElementById('sqlPriceText'),

  // Niche level cards & custom lead price
  levelCards: document.querySelectorAll('.level-card'),
  labelCurrentNicheLevel: document.getElementById('labelCurrentNicheLevel'),
  lvl1PriceVal: document.getElementById('lvl1PriceVal'),
  lvl2PriceVal: document.getElementById('lvl2PriceVal'),
  lvl3PriceVal: document.getElementById('lvl3PriceVal'),
  customLeadPriceInput: document.getElementById('customLeadPriceInput'),

  // Economics inputs & sliders
  dealCheckInput: document.getElementById('dealCheckInput'),
  dealCheckSlider: document.getElementById('dealCheckSlider'),
  dealCheckDisplay: document.getElementById('dealCheckDisplay'),
  quickCheckPills: document.querySelectorAll('.pill-btn[data-check]'),

  marginInput: document.getElementById('marginInput'),
  marginSlider: document.getElementById('marginSlider'),
  marginDisplay: document.getElementById('marginDisplay'),
  quickMarginPills: document.querySelectorAll('.pill-margin'),

  conversionInput: document.getElementById('conversionInput'),
  conversionSlider: document.getElementById('conversionSlider'),
  conversionDisplay: document.getElementById('conversionDisplay'),
  quickConvPills: document.querySelectorAll('.pill-conv'),

  customLeadsInput: document.getElementById('customLeadsInput'),

  ltvToggle: document.getElementById('ltvToggle'),
  ltvSubpanel: document.getElementById('ltvSubpanel'),
  ltvSlider: document.getElementById('ltvSlider'),
  ltvMultiplierDisplay: document.getElementById('ltvMultiplierDisplay'),

  // Scenarios
  scenarioPills: document.querySelectorAll('.scenario-pill'),

  // Payback Hero Elements (TOP)
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
  heroRoiVal: document.getElementById('heroRoiVal'),
  heroRomiMultipleSub: document.getElementById('heroRomiMultipleSub'),
  heroBudgetVal: document.getElementById('heroBudgetVal'),
  heroBudgetBreakdownSub: document.getElementById('heroBudgetBreakdownSub'),

  // Speech Script
  speechScriptQuote: document.getElementById('speechScriptQuote'),
  btnCopyScript: document.getElementById('btnCopyScript'),

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

  // Header Actions & Presets
  btnCopyOffer: document.getElementById('btnCopyOffer'),
  btnShareLink: document.getElementById('btnShareLink'),
  btnPrint: document.getElementById('btnPrint'),
  presetChips: document.querySelectorAll('.preset-chip'),
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
    render();
  });

  DOM.tariff2.addEventListener('click', () => {
    state.tariffMonths = 2;
    state.tariffFixPerMonth = 56000;
    render();
  });

  // Lead format selection (Interest vs Meeting x3)
  DOM.leadTypeMQL.addEventListener('click', () => {
    if (state.leadType !== 'mql') {
      state.leadType = 'mql';
      if (state.conversionPercent >= 25) {
        state.conversionPercent = 15;
      }
      render();
    }
  });

  DOM.leadTypeSQL.addEventListener('click', () => {
    if (state.leadType !== 'sql') {
      state.leadType = 'sql';
      if (state.conversionPercent <= 15) {
        state.conversionPercent = 25;
      }
      render();
    }
  });

  // Niche Level Selection
  DOM.levelCards.forEach(card => {
    card.addEventListener('click', () => {
      state.nicheLevel = parseInt(card.dataset.level, 10);
      state.customLeadPrice = null;
      if (DOM.customLeadPriceInput) DOM.customLeadPriceInput.value = '';
      render();
    });
  });

  // Custom Lead Price Input
  if (DOM.customLeadPriceInput) {
    DOM.customLeadPriceInput.addEventListener('input', (e) => {
      const val = fmt.cleanNum(e.target.value);
      if (val > 0) {
        state.customLeadPrice = val;
      } else {
        state.customLeadPrice = null;
      }
      render();
    });
  }

  // Average Deal Check Input & Slider (MANUAL INPUT ONLY, NO GUESSING)
  DOM.dealCheckSlider.addEventListener('input', (e) => {
    state.dealCheck = parseInt(e.target.value, 10);
    render();
  });

  DOM.dealCheckInput.addEventListener('change', (e) => {
    const val = fmt.cleanNum(e.target.value);
    state.dealCheck = Math.max(10000, Math.min(val, 100000000));
    render();
  });

  DOM.quickCheckPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.dealCheck = parseInt(pill.dataset.check, 10);
      render();
    });
  });

  // Margin % (10–12%, MAX 15%)
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

  // Custom Leads Count
  if (DOM.customLeadsInput) {
    DOM.customLeadsInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (val > 0) {
        state.customLeadsCount = val;
      } else {
        state.customLeadsCount = null;
      }
      render();
    });
  }

  // LTV Toggle & Slider
  DOM.ltvToggle.addEventListener('change', (e) => {
    state.ltvEnabled = e.target.checked;
    render();
  });

  DOM.ltvSlider.addEventListener('input', (e) => {
    state.ltvRepeatDeals = parseInt(e.target.value, 10);
    render();
  });

  // Scenarios
  DOM.scenarioPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.scenario = pill.dataset.scenario;
      render();
    });
  });

  // Presets
  DOM.presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const presetKey = chip.dataset.preset;
      const preset = PRESETS[presetKey];
      if (preset) {
        state.tariffMonths = preset.tariffMonths;
        state.tariffFixPerMonth = preset.tariffMonths === 4 ? 39000 : 56000;
        state.leadType = preset.leadType;
        state.nicheLevel = preset.nicheLevel;
        state.customLeadPrice = null;
        state.customLeadsCount = null;
        state.dealCheck = preset.dealCheck;
        state.marginPercent = preset.marginPercent;
        state.conversionPercent = preset.conversionPercent;
        state.ltvEnabled = preset.ltvEnabled;
        state.ltvRepeatDeals = preset.ltvRepeatDeals;
        
        if (DOM.customLeadPriceInput) DOM.customLeadPriceInput.value = '';
        if (DOM.customLeadsInput) DOM.customLeadsInput.value = '';

        DOM.presetChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');

        showToast(`Загружен пресет: ${preset.name}`);
        render();
      }
    });
  });

  // Action Buttons
  DOM.btnCopyOffer.addEventListener('click', copyClientSummary);
  DOM.btnShareLink.addEventListener('click', copyShareableLink);
  DOM.btnPrint.addEventListener('click', () => window.print());
  if (DOM.btnCopyScript) DOM.btnCopyScript.addEventListener('click', copySpeechScript);
}

// Calculate All Metrics with Margin 10-12% (max 15%)
function calculateMetrics() {
  const tariffData = TARIFF_BENCHMARKS[state.tariffMonths];
  const isSql = state.leadType === 'sql';
  const multiplier = isSql ? 3 : 1;

  // Base price per lead
  const basePrice = (state.customLeadPrice && state.customLeadPrice > 0)
    ? state.customLeadPrice
    : LEVEL_MQL_PRICES[state.nicheLevel];
  const currentLeadPrice = basePrice * multiplier;

  // Leads count: custom or scenario-based
  let leadsCount = (state.customLeadsCount && state.customLeadsCount > 0)
    ? state.customLeadsCount
    : tariffData.leadsAvg;
    
  let effectiveConv = state.conversionPercent;

  if (!state.customLeadsCount) {
    if (state.scenario === 'pessimistic') {
      leadsCount = tariffData.leadsMin;
      effectiveConv = Math.max(1, Math.round(state.conversionPercent * 0.8));
    } else if (state.scenario === 'optimistic') {
      leadsCount = tariffData.leadsMax;
      effectiveConv = Math.round(state.conversionPercent * 1.15);
    }
  }

  // Repeat deals multiplier
  const ltvFactor = state.ltvEnabled ? (1 + state.ltvRepeatDeals) : 1;

  // Closed deals forecast
  const exactDeals = leadsCount * (effectiveConv / 100);
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
    isSql,
    multiplier,
    basePrice,
    currentLeadPrice,
    leadsCount,
    dealsCount,
    exactDeals,
    effectiveConv,
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

  // 2. Lead Format
  DOM.leadTypeMQL.classList.toggle('active', !m.isSql);
  DOM.leadTypeSQL.classList.toggle('active', m.isSql);
  DOM.labelLeadFormatNote.textContent = m.isSql ? 'Премиум-созвоны (x3)' : 'Базовая ставка';

  // Dynamic price labels on cards
  const curBasePrice = state.customLeadPrice || LEVEL_MQL_PRICES[state.nicheLevel];
  DOM.mqlPriceText.textContent = `${fmt.num(curBasePrice)} руб. / лид`;
  DOM.sqlPriceText.textContent = `${fmt.num(curBasePrice * 3)} руб. / лид`;

  // 3. Niche Level Cards
  const mult = m.isSql ? 3 : 1;
  DOM.lvl1PriceVal.textContent = fmt.rub(LEVEL_MQL_PRICES[1] * mult);
  DOM.lvl2PriceVal.textContent = fmt.rub(LEVEL_MQL_PRICES[2] * mult);
  DOM.lvl3PriceVal.textContent = fmt.rub(LEVEL_MQL_PRICES[3] * mult);

  DOM.levelCards.forEach(card => {
    const lvl = parseInt(card.dataset.level, 10);
    card.classList.toggle('active', lvl === state.nicheLevel && !state.customLeadPrice);
  });
  DOM.labelCurrentNicheLevel.textContent = state.customLeadPrice
    ? `Своя цена (${fmt.rub(m.currentLeadPrice)})`
    : `Уровень ${state.nicheLevel}`;

  // 4. Client Economics Inputs
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

  // Scenarios
  DOM.scenarioPills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.scenario === state.scenario);
  });

  // ==================== 5. TOP PAYBACK HERO (ТОЧКА БЕЗУБЫТОЧНОСТИ) ====================
  DOM.beTotalLeads.textContent = m.leadsCount;
  DOM.breakevenBigText.innerHTML = `
    Достаточно закрыть <span class="highlight-deals">всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)}</span> из ${m.leadsCount} лидов
  `;
  DOM.beDealsVal.textContent = `${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)}`;
  DOM.beProfitPerDealSub.textContent = `Маржа со сделки: ${fmt.rub(m.profitPerDeal)} (${state.marginPercent}%)`;
  DOM.beConversionVal.textContent = `всего ${m.breakEvenConversion}%`;

  // Progress Bar: Break-even vs Profit Deals
  const beRatio = Math.min(100, Math.max(10, Math.round((m.dealsToBreakEven / Math.max(m.dealsCount, m.dealsToBreakEven)) * 100)));
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
    ${m.profitDealsCount > 0 ? `Оставшиеся <strong>${m.profitDealsCount} ${pluralDeals(m.profitDealsCount)}</strong> первого цикла приносят чистую прибыль сверх расходов на запуск.` : `Все последующие сделки и повторные заказы приносят 100% чистую прибыль.`}
  `;

  // ==================== 6. FINANCIAL TOTALS ====================
  DOM.heroNetProfitVal.textContent = `${m.netProfit >= 0 ? '+' : ''}${fmt.rub(m.netProfit)}`;
  DOM.heroNetProfitVal.style.color = m.netProfit >= 0 ? 'var(--teal)' : '#DC2626';

  DOM.heroRoiVal.textContent = fmt.pct(m.roi);
  DOM.heroRoiVal.style.color = m.roi >= 0 ? 'var(--primary)' : '#DC2626';
  DOM.heroRomiMultipleSub.textContent = `Возврат бюджета в ${m.romiMultiple} раза`;

  DOM.heroBudgetVal.textContent = fmt.rub(m.totalBudget);
  DOM.heroBudgetBreakdownSub.textContent = `${fmt.rub(m.fixTotal)} фикс + ${m.leadsCount} лидов`;

  // ==================== 7. SPEECH SCRIPT QUOTE ====================
  const quoteText = `«За ${state.tariffMonths} месяца мы передадим вам ${m.leadsCount} лидов с подтвержденным интересом. Ваши суммарные инвестиции составят ${fmt.rub(m.totalBudget)}. При среднем чеке ${fmt.rub(state.dealCheck)} и чистой марже ${state.marginPercent}% валовая прибыль с одной сделки составляет ${fmt.rub(m.profitPerDeal)}. Поэтому для полной окупаемости договора вам достаточно закрыть всего ${m.dealsToBreakEven} из ${m.leadsCount} лидов (конверсия всего ${m.breakEvenConversion}%). Всё, что вы закроете сверх этого (еще ${m.profitDealsCount} ${pluralDeals(m.profitDealsCount)} на ${fmt.rub(m.profitDealsCount * m.profitPerDeal)} чистой прибыли), остаётся вашей чистой прибылью сверх затрат на запуск.»`;
  DOM.speechScriptQuote.textContent = quoteText;

  // ==================== 8. SECONDARY METRICS (BELOW) ====================
  DOM.statRevenueVal.textContent = fmt.rub(m.grossRevenue);
  DOM.statCostShareVal.textContent = `Доля затрат в обороте: ~${m.costShare}%`;

  DOM.statDealsVal.textContent = `${m.dealsCount} ${pluralDeals(m.dealsCount)}`;
  DOM.statDealsProfit.textContent = `Маржа со сделки: ${fmt.rub(m.profitPerDeal)}`;

  DOM.statLeadsVal.textContent = `${m.leadsCount} лидов`;
  DOM.statLeadsRange.textContent = state.customLeadsCount
    ? `Ручной ввод: ${state.customLeadsCount} лидов`
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
    const monthDeals = Math.max(1, Math.round(monthLeads * (m.effectiveConv / 100)));
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

// Copy Structured Client Calculation for Telegram / Email
function copyClientSummary() {
  const m = calculateMetrics();
  const formatName = m.isSql ? 'Квалифицированные созвоны/встречи под ТЗ (ставка x3)' : 'Лиды с подтвержденным интересом';

  const text = `
🎯 Расчет окупаемости лидогенерации Call-Talk:

• Срок договора: ${state.tariffMonths} месяца
• База в обработке: ${fmt.num(m.tariffData.totalBaseContacts)} целевых контактов
• Формат лидов: ${formatName}
• Ставка за лид: ${fmt.rub(m.currentLeadPrice)} (отказы и спам не оплачиваются)
• Фикс за инфраструктуру: ${fmt.rubPerMonth(state.tariffFixPerMonth)} (${fmt.rub(m.fixTotal)} за весь период)
• Общие инвестиции: ${fmt.rub(m.totalBudget)} (фикс + оплата за лиды)

🛡️ ГЛАВНОЕ — ТОЧКА БЕЗУБЫТОЧНОСТИ:
При вашем среднем чеке ${fmt.rub(state.dealCheck)} и маржинальности ${state.marginPercent}% валовая прибыль со сделки составляет ${fmt.rub(m.profitPerDeal)}.
Вам достаточно закрыть ВСЕГО ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} переданных лидов (конверсия всего ${m.breakEvenConversion}%), чтобы полностью вернуть 100% затрат на запуск.
${m.profitDealsCount > 0 ? `Оставшиеся ${m.profitDealsCount} ${pluralDeals(m.profitDealsCount)} первого цикла приносят чистую прибыль!` : `Все последующие сделки генерируют чистую прибыль.`}

💰 Финансовая экономика (при конверсии ${m.effectiveConv}%):
• Прогноз лидов: ${m.leadsCount} (вилка тарифа: ${m.tariffData.leadsMin}–${m.tariffData.leadsMax})
• Прогноз закрытых сделок: ${m.dealsCount} ${pluralDeals(m.dealsCount)}
• Привлеченная выручка: ${fmt.rub(m.grossRevenue)}
• Чистая прибыль сверх затрат: +${fmt.rub(m.netProfit)}
• Окупаемость затрат (ROI): ${fmt.pct(m.roi)}
• Доля затрат на маркетинг: всего ~${m.costShare}% от привлеченного оборота
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    showToast('Полный расчет скопирован в буфер обмена!');
  }).catch(() => {
    showToast('Ошибка копирования. Выделите текст вручную.');
  });
}

// Copy Speech Script Quote
function copySpeechScript() {
  const quote = DOM.speechScriptQuote.textContent.trim();
  navigator.clipboard.writeText(quote).then(() => {
    showToast('Речевой модуль для встречи скопирован!');
  }).catch(() => {
    showToast('Ошибка копирования.');
  });
}

// Copy Shareable URL with Current Parameters
function copyShareableLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Ссылка с текущими параметрами скопирована!');
  }).catch(() => {
    showToast('Не удалось скопировать ссылку.');
  });
}

// Show Toast Message
function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
    <span>${message}</span>
  `;
  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, 2800);
}

// Sync State to URL Hash / Params
function syncStateToUrl() {
  const params = new URLSearchParams();
  params.set('t', state.tariffMonths);
  params.set('fmt', state.leadType);
  params.set('lvl', state.nicheLevel);
  params.set('chk', state.dealCheck);
  params.set('mg', state.marginPercent);
  params.set('cv', state.conversionPercent);
  if (state.customLeadPrice) params.set('clp', state.customLeadPrice);
  if (state.customLeadsCount) params.set('clc', state.customLeadsCount);
  if (state.ltvEnabled) {
    params.set('ltv', '1');
    params.set('ltvc', state.ltvRepeatDeals);
  }
  if (state.scenario !== 'base') {
    params.set('sc', state.scenario);
  }

  const newUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', newUrl);
}

// Load State from URL
function loadUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.has('t')) state.tariffMonths = parseInt(params.get('t'), 10) === 2 ? 2 : 4;
  if (params.has('fmt')) state.leadType = params.get('fmt') === 'sql' ? 'sql' : 'mql';
  if (params.has('lvl')) state.nicheLevel = parseInt(params.get('lvl'), 10) || 2;
  if (params.has('chk')) state.dealCheck = parseInt(params.get('chk'), 10) || 1000000;
  if (params.has('mg')) state.marginPercent = parseInt(params.get('mg'), 10) || 12;
  if (params.has('cv')) state.conversionPercent = parseInt(params.get('cv'), 10) || 15;
  if (params.has('clp')) state.customLeadPrice = parseInt(params.get('clp'), 10);
  if (params.has('clc')) state.customLeadsCount = parseInt(params.get('clc'), 10);
  if (params.has('ltv')) state.ltvEnabled = params.get('ltv') === '1';
  if (params.has('ltvc')) state.ltvRepeatDeals = parseInt(params.get('ltvc'), 10) || 2;
  if (params.has('sc')) state.scenario = params.get('sc');

  state.tariffFixPerMonth = state.tariffMonths === 4 ? 39000 : 56000;
}

// Boot
window.addEventListener('DOMContentLoaded', init);
