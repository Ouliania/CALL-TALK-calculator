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
  pluralLeads: (n) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'лидов';
    if (mod10 === 1) return 'лид';
    if (mod10 >= 2 && mod10 <= 4) return 'лида';
    return 'лидов';
  },
  genitiveLeads: (n) => {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'лидов';
    if (mod10 === 1) return 'лида';
    return 'лидов';
  },
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
  mailboxesCount: 10,       // 10, 15, 20, 30
  leadPrice: 2800,          // manual input
  scenario: 'medium',       // 'pessimistic' | 'medium' | 'optimistic' | 'custom'
  leadsCount: 78,           // dynamic based on scenario and mailboxes
  dealCheck: 1000000,       // average deal in rubles
  marginPercent: 12,        // 12% (strictly 10-12%, max 15%)
  conversionPercent: 15,    // 15%
  ltvEnabled: false,
  ltvMode: 'coeff',         // 'coeff' (разовые покупки / коэффициент) or 'sub' (подписка)
  ltvCoeff: 1.3,            // 1.3 (e.g. 10 deals -> +3 repeat = 13 deals)
  ltvRepeatDeals: 2         // +2 repeat deals in subscription mode
};

// Base tariff benchmarks (Call-Talk conversion standards)
const TARIFF_DATA = {
  4: {
    months: 4,
    fixPerMonth: 39000,
    scenarios: {
      pessimistic: {
        baseLeads: 63,
        monthly: [
          { name: '1-й месяц (запуск и прогрев)', leads: 9 },
          { name: '2-й месяц', leads: 18 },
          { name: '3-й месяц', leads: 18 },
          { name: '4-й месяц', leads: 18 }
        ]
      },
      medium: {
        baseLeads: 78,
        monthly: [
          { name: '1-й месяц (запуск и прогрев)', leads: 11 },
          { name: '2-й месяц', leads: 22 },
          { name: '3-й месяц', leads: 22 },
          { name: '4-й месяц', leads: 23 }
        ]
      },
      optimistic: {
        baseLeads: 94,
        monthly: [
          { name: '1-й месяц (запуск и прогрев)', leads: 14 },
          { name: '2-й месяц', leads: 26 },
          { name: '3-й месяц', leads: 27 },
          { name: '4-й месяц', leads: 27 }
        ]
      }
    }
  },
  2: {
    months: 2,
    fixPerMonth: 56000,
    scenarios: {
      pessimistic: {
        baseLeads: 27,
        monthly: [
          { name: '1-й месяц (запуск и прогрев)', leads: 9 },
          { name: '2-й месяц', leads: 18 }
        ]
      },
      medium: {
        baseLeads: 34,
        monthly: [
          { name: '1-й месяц (запуск и прогрев)', leads: 11 },
          { name: '2-й месяц', leads: 23 }
        ]
      },
      optimistic: {
        baseLeads: 41,
        monthly: [
          { name: '1-й месяц (запуск и прогрев)', leads: 14 },
          { name: '2-й месяц', leads: 27 }
        ]
      }
    }
  }
};

function getScenarioLeads(scenarioName, months = state.tariffMonths, mailboxes = state.mailboxesCount) {
  const mult = mailboxes / 10;
  const scObj = TARIFF_DATA[months]?.scenarios[scenarioName];
  if (!scObj) return 78;
  return Math.round(scObj.baseLeads * mult);
}

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

  // LTV & Repeat Deals (Two Modes: Coeff vs Subscription)
  ltvToggle: document.getElementById('ltvToggle'),
  ltvSubpanel: document.getElementById('ltvSubpanel'),
  ltvModeCoeffBtn: document.getElementById('ltvModeCoeffBtn'),
  ltvModeSubBtn: document.getElementById('ltvModeSubBtn'),
  ltvCoeffView: document.getElementById('ltvCoeffView'),
  ltvSubView: document.getElementById('ltvSubView'),
  ltvCoeffInput: document.getElementById('ltvCoeffInput'),
  ltvCoeffSlider: document.getElementById('ltvCoeffSlider'),
  ltvCoeffDisplay: document.getElementById('ltvCoeffDisplay'),
  quickLtvCoeffPills: document.querySelectorAll('.pill-ltv-coeff'),
  ltvCoeffNote: document.getElementById('ltvCoeffNote'),
  ltvSubInput: document.getElementById('ltvSubInput'),
  ltvSlider: document.getElementById('ltvSlider'),
  ltvMultiplierDisplay: document.getElementById('ltvMultiplierDisplay'),
  quickLtvPills: document.querySelectorAll('.pill-ltv'),

  // Scenario Selector Bar
  scenarioBtns: document.querySelectorAll('.scenario-btn'),
  scenarioLeadsPessimistic: document.getElementById('scenarioLeadsPessimistic'),
  scenarioLeadsMedium: document.getElementById('scenarioLeadsMedium'),
  scenarioLeadsOptimistic: document.getElementById('scenarioLeadsOptimistic'),

  // Forecast & Revenue (Hero Block at Top)
  forecastHeadline: document.getElementById('forecastHeadline'),
  forecastDealsVal: document.getElementById('forecastDealsVal'),
  forecastRevenueVal: document.getElementById('forecastRevenueVal'),
  forecastSubText: document.getElementById('forecastSubText'),

  // 5 Financial Stat Cards
  heroRevenueVal: document.getElementById('heroRevenueVal'),
  heroRevenueSub: document.getElementById('heroRevenueSub'),
  heroGrossRemainingVal: document.getElementById('heroGrossRemainingVal'),
  heroGrossRemainingSub: document.getElementById('heroGrossRemainingSub'),
  heroNetProfitVal: document.getElementById('heroNetProfitVal'),
  heroNetProfitSub: document.getElementById('heroNetProfitSub'),
  heroRoiVal: document.getElementById('heroRoiVal'),
  heroRomiMultipleSub: document.getElementById('heroRomiMultipleSub'),
  heroBudgetVal: document.getElementById('heroBudgetVal'),
  heroBudgetBreakdownSub: document.getElementById('heroBudgetBreakdownSub'),

  // Monthly Table
  tableBadgePeriod: document.getElementById('tableBadgePeriod'),
  funnelTableBody: document.getElementById('funnelTableBody'),

  // Break-even (Compact, lower)
  breakevenBigText: document.getElementById('breakevenBigText'),
  bePillConv: document.getElementById('bePillConv'),
  beLabelBreakEven: document.getElementById('beLabelBreakEven'),
  beLabelProfitDeals: document.getElementById('beLabelProfitDeals'),
  beProgressFillBe: document.getElementById('beProgressFillBe'),
  beProgressFillProfit: document.getElementById('beProgressFillProfit'),
  breakevenExplanationText: document.getElementById('breakevenExplanationText'),

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

  // Scenario selection (Пессимистичный / Средний / Оптимистичный)
  if (DOM.scenarioBtns) {
    DOM.scenarioBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const sc = btn.dataset.scenario;
        setScenario(sc);
      });
    });
  }

  // Leads count input (manual override)
  DOM.leadsCountInput.addEventListener('input', (e) => {
    const val = parseInt(e.target.value.replace(/\D/g, ''), 10);
    if (!isNaN(val) && val > 0) {
      state.leadsCount = Math.max(1, Math.min(val, 50000));
      const pLeads = getScenarioLeads('pessimistic');
      const mLeads = getScenarioLeads('medium');
      const oLeads = getScenarioLeads('optimistic');
      if (state.leadsCount === pLeads) {
        state.scenario = 'pessimistic';
      } else if (state.leadsCount === mLeads) {
        state.scenario = 'medium';
      } else if (state.leadsCount === oLeads) {
        state.scenario = 'optimistic';
      } else {
        state.scenario = 'custom';
      }
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

  // LTV Toggle & Modes
  DOM.ltvToggle.addEventListener('change', (e) => {
    state.ltvEnabled = e.target.checked;
    render();
  });

  if (DOM.ltvModeCoeffBtn) {
    DOM.ltvModeCoeffBtn.addEventListener('click', () => {
      state.ltvMode = 'coeff';
      render();
    });
  }

  if (DOM.ltvModeSubBtn) {
    DOM.ltvModeSubBtn.addEventListener('click', () => {
      state.ltvMode = 'sub';
      render();
    });
  }

  // Coeff Mode Controls
  if (DOM.ltvCoeffInput) {
    DOM.ltvCoeffInput.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val) && val >= 1.0) {
        state.ltvCoeff = Math.round(val * 100) / 100;
        render();
      }
    });
  }

  if (DOM.ltvCoeffSlider) {
    DOM.ltvCoeffSlider.addEventListener('input', (e) => {
      state.ltvCoeff = parseFloat(e.target.value);
      render();
    });
  }

  if (DOM.quickLtvCoeffPills) {
    DOM.quickLtvCoeffPills.forEach(pill => {
      pill.addEventListener('click', () => {
        state.ltvCoeff = parseFloat(pill.dataset.coeff);
        render();
      });
    });
  }

  // Subscription Mode Controls
  if (DOM.ltvSubInput) {
    DOM.ltvSubInput.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (!isNaN(val) && val >= 1) {
        state.ltvRepeatDeals = Math.min(val, 30);
        render();
      }
    });
  }

  if (DOM.ltvSlider) {
    DOM.ltvSlider.addEventListener('input', (e) => {
      state.ltvRepeatDeals = parseInt(e.target.value, 10);
      render();
    });
  }

  if (DOM.quickLtvPills) {
    DOM.quickLtvPills.forEach(pill => {
      pill.addEventListener('click', () => {
        state.ltvRepeatDeals = parseInt(pill.dataset.ltv, 10);
        render();
      });
    });
  }

  // Action Buttons
  DOM.btnCopyOffer.addEventListener('click', copyClientSummary);
  DOM.btnShareLink.addEventListener('click', copyShareableLink);
  DOM.btnPrint.addEventListener('click', () => window.print());
  if (DOM.btnCopyConclusions) DOM.btnCopyConclusions.addEventListener('click', copyConclusions);
}

// Set Scenario ('pessimistic' | 'medium' | 'optimistic')
function setScenario(sc) {
  state.scenario = sc;
  state.leadsCount = getScenarioLeads(sc);
  DOM.leadsCountInput.value = state.leadsCount;
  render();
}

// Calculate leads automatically from mailboxes (scales current scenario)
function updateLeadsFromMailboxes() {
  const sc = (state.scenario && state.scenario !== 'custom') ? state.scenario : 'medium';
  state.leadsCount = getScenarioLeads(sc);
  DOM.leadsCountInput.value = state.leadsCount;
}

// Calculate Metrics
function calculateMetrics() {
  const tariffData = TARIFF_DATA[state.tariffMonths];
  const leadsCount = state.leadsCount;
  const currentLeadPrice = state.leadPrice;

  // Base closed deals from cold leads
  const exactBaseDeals = leadsCount * (state.conversionPercent / 100);
  const baseDealsCount = Math.max(1, Math.round(exactBaseDeals));

  // LTV & Repeat Deals calculation
  let dealsCount = baseDealsCount;
  let repeatDealsCount = 0;
  let ltvFactor = 1;

  if (state.ltvEnabled) {
    if (state.ltvMode === 'coeff') {
      dealsCount = Math.max(1, Math.round(baseDealsCount * state.ltvCoeff));
      repeatDealsCount = Math.max(0, dealsCount - baseDealsCount);
      ltvFactor = state.ltvCoeff;
    } else {
      dealsCount = baseDealsCount * (1 + state.ltvRepeatDeals);
      repeatDealsCount = baseDealsCount * state.ltvRepeatDeals;
      ltvFactor = 1 + state.ltvRepeatDeals;
    }
  }

  // Margin per deal (strictly from margin 10-12-15%)
  const marginFrac = state.marginPercent / 100;
  const profitPerDeal = state.dealCheck * marginFrac;

  // Call-Talk Costs
  const fixTotal = state.tariffMonths * state.tariffFixPerMonth;
  const variableTotal = leadsCount * currentLeadPrice;
  const totalBudget = fixTotal + variableTotal;

  // Break-even
  const exactDealsToBreakEven = profitPerDeal > 0 ? (totalBudget / profitPerDeal) : 0;
  const dealsToBreakEven = Math.max(1, Math.ceil(exactDealsToBreakEven));
  const breakEvenConversion = leadsCount > 0 ? ((exactDealsToBreakEven / leadsCount) * 100).toFixed(1) : '0.0';
  const profitDealsCount = Math.max(0, dealsCount - dealsToBreakEven);

  // Financial totals:
  // 1. Привлеченная выручка (все сделки * чек)
  const grossRevenue = dealsCount * state.dealCheck;

  // 2. Выручка за вычетом сервиса (сколько денег остается на счете клиента за минусом Call-Talk)
  const grossRemaining = Math.max(0, grossRevenue - totalBudget);

  // 3. Валовая прибыль (с учетом чистой маржи)
  const grossProfit = grossRevenue * marginFrac;

  // 4. Чистая прибыль (сверх ВСЕХ затрат, себестоимости и бюджета Call-Talk)
  const netProfit = grossProfit - totalBudget;

  // 5. Окупаемость
  const roi = totalBudget > 0 ? Math.round((netProfit / totalBudget) * 100) : 0;
  const romiMultiple = totalBudget > 0 ? (grossProfit / totalBudget).toFixed(1) : '0.0';

  return {
    tariffData,
    currentLeadPrice,
    leadsCount,
    baseDealsCount,
    dealsCount,
    repeatDealsCount,
    ltvFactor,
    profitPerDeal,
    fixTotal,
    variableTotal,
    totalBudget,
    dealsToBreakEven,
    breakEvenConversion,
    profitDealsCount,
    grossRevenue,
    grossRemaining,
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

  // 0. Scenarios (Пессимистичный / Средний / Оптимистичный)
  const pLeads = getScenarioLeads('pessimistic');
  const mLeads = getScenarioLeads('medium');
  const oLeads = getScenarioLeads('optimistic');

  if (DOM.scenarioLeadsPessimistic) {
    DOM.scenarioLeadsPessimistic.textContent = `${pLeads} ${fmt.pluralLeads(pLeads)}`;
  }
  if (DOM.scenarioLeadsMedium) {
    DOM.scenarioLeadsMedium.textContent = `${mLeads} ${fmt.pluralLeads(mLeads)}`;
  }
  if (DOM.scenarioLeadsOptimistic) {
    DOM.scenarioLeadsOptimistic.textContent = `${oLeads} ${fmt.pluralLeads(oLeads)}`;
  }

  if (DOM.scenarioBtns) {
    DOM.scenarioBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.scenario === state.scenario);
    });
  }

  // 1. Tariffs
  DOM.tariff4.classList.toggle('active', state.tariffMonths === 4);
  DOM.tariff2.classList.toggle('active', state.tariffMonths === 2);
  DOM.tableBadgePeriod.textContent = state.tariffMonths === 2 ? 'Срок: 2 месяца (тест)' : 'Срок: 4 месяца';

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

  // LTV UI
  DOM.ltvToggle.checked = state.ltvEnabled;
  DOM.ltvSubpanel.style.display = state.ltvEnabled ? 'block' : 'none';

  if (DOM.ltvModeCoeffBtn) DOM.ltvModeCoeffBtn.classList.toggle('active', state.ltvMode === 'coeff');
  if (DOM.ltvModeSubBtn) DOM.ltvModeSubBtn.classList.toggle('active', state.ltvMode === 'sub');
  if (DOM.ltvCoeffView) DOM.ltvCoeffView.style.display = state.ltvMode === 'coeff' ? 'block' : 'none';
  if (DOM.ltvSubView) DOM.ltvSubView.style.display = state.ltvMode === 'sub' ? 'block' : 'none';

  // Coeff controls
  if (DOM.ltvCoeffDisplay) DOM.ltvCoeffDisplay.textContent = `${state.ltvCoeff}×`;
  if (DOM.ltvCoeffInput && document.activeElement !== DOM.ltvCoeffInput) {
    DOM.ltvCoeffInput.value = state.ltvCoeff;
  }
  if (DOM.ltvCoeffSlider) DOM.ltvCoeffSlider.value = state.ltvCoeff;
  if (DOM.quickLtvCoeffPills) {
    DOM.quickLtvCoeffPills.forEach(pill => {
      pill.classList.toggle('active', parseFloat(pill.dataset.coeff) === state.ltvCoeff);
    });
  }
  if (DOM.ltvCoeffNote) {
    const repeatPct = Math.round((state.ltvCoeff - 1) * 100);
    const repeatPer10 = Math.round((state.ltvCoeff - 1) * 10);
    DOM.ltvCoeffNote.textContent = `Коэффициент ${state.ltvCoeff}: на каждые 10 новых клиентов приходится ${repeatPer10} повторных заказов (+${repeatPct}% к объему сделок)`;
  }

  // Subscription controls
  if (DOM.ltvMultiplierDisplay) DOM.ltvMultiplierDisplay.textContent = `+${state.ltvRepeatDeals} ${pluralOrders(state.ltvRepeatDeals)}`;
  if (DOM.ltvSubInput && document.activeElement !== DOM.ltvSubInput) {
    DOM.ltvSubInput.value = state.ltvRepeatDeals;
  }
  if (DOM.ltvSlider) DOM.ltvSlider.value = state.ltvRepeatDeals;
  if (DOM.quickLtvPills) {
    DOM.quickLtvPills.forEach(pill => {
      pill.classList.toggle('active', parseInt(pill.dataset.ltv, 10) === state.ltvRepeatDeals);
    });
  }

  // ==================== 1. ПРОГНОЗ ПРОДАЖ И ФИНАНСОВЫЙ ИТОГ (ГЛАВНЫЙ БЛОК НАВЕРХУ) ====================
  if (DOM.forecastDealsVal) DOM.forecastDealsVal.textContent = `${m.dealsCount} ${pluralDeals(m.dealsCount)}`;
  if (DOM.forecastRevenueVal) DOM.forecastRevenueVal.textContent = fmt.rub(m.grossRevenue);
  if (DOM.forecastSubText) {
    const scPrefix = state.scenario === 'pessimistic' ? 'Пессимистичный сценарий: из '
      : state.scenario === 'optimistic' ? 'Оптимистичный сценарий: из '
      : state.scenario === 'custom' ? 'Индивидуальный расчет: из '
      : 'Из ';

    if (state.ltvEnabled) {
      if (state.ltvMode === 'coeff') {
        DOM.forecastSubText.textContent = `${scPrefix}${m.leadsCount} ${fmt.genitiveLeads(m.leadsCount)} с подтвержденным интересом (${m.baseDealsCount} первичных + ${m.repeatDealsCount} повторных по коэфф. ${state.ltvCoeff}×) при конверсии отдела продаж ${state.conversionPercent}%`;
      } else {
        DOM.forecastSubText.textContent = `${scPrefix}${m.leadsCount} ${fmt.genitiveLeads(m.leadsCount)} с подтвержденным интересом (${m.baseDealsCount} первичных клиентов, каждый совершает еще +${state.ltvRepeatDeals} ${pluralOrders(state.ltvRepeatDeals)}) при конверсии отдела продаж ${state.conversionPercent}%`;
      }
    } else {
      DOM.forecastSubText.textContent = `${scPrefix}${m.leadsCount} ${fmt.genitiveLeads(m.leadsCount)} с подтвержденным интересом при конверсии отдела продаж ${state.conversionPercent}%`;
    }
  }

  // 5 Financial Stat Cards
  // 1. Привлеченная выручка
  if (DOM.heroRevenueVal) DOM.heroRevenueVal.textContent = fmt.rub(m.grossRevenue);
  if (DOM.heroRevenueSub) DOM.heroRevenueSub.textContent = `${m.dealsCount} ${pluralDeals(m.dealsCount)} по ${fmt.rub(state.dealCheck)}`;

  // 2. Выручка за вычетом сервиса Call-Talk
  if (DOM.heroGrossRemainingVal) DOM.heroGrossRemainingVal.textContent = fmt.rub(m.grossRemaining);
  if (DOM.heroGrossRemainingSub) DOM.heroGrossRemainingSub.textContent = `Остаток на счете после оплаты сервиса`;

  // 3. Чистая прибыль сверх ВСЕХ затрат (с учетом маржи) — АКЦЕНТ
  if (DOM.heroNetProfitVal) {
    DOM.heroNetProfitVal.textContent = `${m.netProfit >= 0 ? '+' : ''}${fmt.rub(m.netProfit)}`;
    DOM.heroNetProfitVal.style.color = m.netProfit >= 0 ? '#059669' : '#DC2626';
  }
  if (DOM.heroNetProfitSub) {
    DOM.heroNetProfitSub.textContent = `Чистыми сверх всех затрат и маржи ${state.marginPercent}%`;
  }

  // 4. Окупаемость
  DOM.heroRoiVal.textContent = fmt.pct(m.roi);
  DOM.heroRoiVal.style.color = m.roi >= 0 ? 'var(--primary)' : '#DC2626';
  DOM.heroRomiMultipleSub.textContent = `Возврат бюджета в ${m.romiMultiple} раза`;

  if (DOM.heroBudgetVal) DOM.heroBudgetVal.textContent = fmt.rub(m.totalBudget);
  if (DOM.heroBudgetBreakdownSub) DOM.heroBudgetBreakdownSub.textContent = `${fmt.rub(m.fixTotal)} фикс + ${m.leadsCount} лидов`;

  // ==================== 2. ПОМЕСЯЧНЫЙ ПЛАН И ПЛАТЕЖИ ====================
  renderMonthlyTable(m);

  // ==================== 3. ТОЧКА БЕЗУБЫТОЧНОСТИ (ПОРОГ ОКУПАЕМОСТИ, НИЖЕ) ====================
  DOM.breakevenBigText.innerHTML = `
    Достаточно закрыть <span class="highlight-be-deals">всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)}</span> из ${m.leadsCount} ${fmt.genitiveLeads(m.leadsCount)}
  `;
  if (DOM.bePillConv) {
    DOM.bePillConv.textContent = `Порог конверсии: ${m.breakEvenConversion}%`;
  }

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
  const activeScenarioKey = (state.scenario && state.scenario !== 'custom') ? state.scenario : 'medium';
  const scObj = m.tariffData.scenarios[activeScenarioKey];
  const months = scObj.monthly;
  const baseTotal = scObj.baseLeads;
  let html = '';

  let accumLeads = 0;
  let accumDeals = 0;
  let accumCost = 0;

  months.forEach((row, idx) => {
    const isLast = idx === months.length - 1;
    let monthLeads;
    if (state.scenario !== 'custom') {
      const mult = state.mailboxesCount / 10;
      monthLeads = Math.round(row.leads * mult);
    } else {
      monthLeads = Math.round(m.leadsCount * (row.leads / baseTotal));
    }
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
        <td><strong>${monthLeads} ${fmt.pluralLeads(monthLeads)}</strong></td>
        <td><strong>${monthDeals} ${pluralDeals(monthDeals)}</strong></td>
        <td>${fmt.rub(monthCost)}</td>
      </tr>
    `;
  });

  const periodTitle = state.tariffMonths === 2 ? '2 МЕСЯЦА (ТЕСТ)' : '4 МЕСЯЦА';
  html += `
    <tr class="total-row">
      <td><strong>ИТОГО ЗА ${periodTitle}</strong></td>
      <td><strong>${accumLeads} ${fmt.pluralLeads(accumLeads)}</strong></td>
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
      <svg class="conclusion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
      <div>
        <strong>Прогноз продаж и дохода:</strong> при конверсии отдела продаж ${state.conversionPercent}% прогнозируется 
        <strong>${m.dealsCount} ${pluralDeals(m.dealsCount)}</strong> из ${m.leadsCount} ${fmt.genitiveLeads(m.leadsCount)}. Это дает 
        <strong>${fmt.rub(m.grossRevenue)} привлеченной выручки</strong> и 
        <strong>+${fmt.rub(m.netProfit)} чистой прибыли</strong> сверх всех затрат на Call-Talk (возврат бюджета в ${m.romiMultiple} раза).
      </div>
    </div>

    <div class="conclusion-item">
      <svg class="conclusion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
      <div>
        <strong>Защита от рисков (порог окупаемости):</strong> чтобы полностью вернуть бюджет (${fmt.rub(m.totalBudget)}), достаточно закрыть 
        <strong>всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)}</strong> (конверсия <strong>всего ${m.breakEvenConversion}%</strong>). 
        Проект окупается, даже если ${Math.round(100 - parseFloat(m.breakEvenConversion))}% лидов ответят отказом.
      </div>
    </div>

    <div class="conclusion-item">
      <svg class="conclusion-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 14 14"></polyline></svg>
      <div>
        <strong>Оплата за результат:</strong> фикс покрывает подготовку и инфраструктуру на базе <strong>${state.mailboxesCount} ящиков Яндекс 360</strong>. 
        Лиды оплачиваются только при подтвержденном интересе ЛПР. Нецелевые контакты — 0 руб.
      </div>
    </div>
  `;
}

// Copy Calculation for Client
function copyClientSummary() {
  const m = calculateMetrics();

  const scenarioTitle = {
    pessimistic: 'Пессимистичный (минимум)',
    medium: 'Средний (базовый)',
    optimistic: 'Оптимистичный (максимум)',
    custom: 'Индивидуальный'
  }[state.scenario] || 'Средний (базовый)';

  const ltvSummary = state.ltvEnabled
    ? (state.ltvMode === 'coeff' ? ` (с учетом LTV: коэфф. ${state.ltvCoeff}×, +${Math.round((state.ltvCoeff - 1) * 100)}% допродаж)` : ` (с учетом LTV: +${state.ltvRepeatDeals} ${pluralOrders(state.ltvRepeatDeals)})`)
    : '';

  const text = `
Расчет результатов проекта Call-Talk (${scenarioTitle}):

Прогноз продаж:
• Закрытых сделок: ${m.dealsCount} ${pluralDeals(m.dealsCount)} из ${m.leadsCount} ${fmt.pluralLeads(m.leadsCount)} (конверсия ${state.conversionPercent}%)${ltvSummary}
• Привлеченная выручка: ${fmt.rub(m.grossRevenue)}
• Выручка за вычетом Call-Talk: ${fmt.rub(m.grossRemaining)} (остаток на счете клиента)
• Чистая прибыль сверх ВСЕХ затрат (маржа ${state.marginPercent}%): +${fmt.rub(m.netProfit)}
• Окупаемость затрат (ROI): ${fmt.pct(m.roi)} (возврат бюджета в ${m.romiMultiple} раза)

Условия проекта:
• Сценарий прогноза: ${scenarioTitle}
• Срок договора: ${state.tariffMonths} месяца${state.tariffMonths === 2 ? ' (тест)' : ''}
• Почтовая инфраструктура: ${state.mailboxesCount} ящиков Яндекс 360
• Прогноз лидов: ${m.leadsCount} ${fmt.pluralLeads(m.leadsCount)} с подтвержденным интересом
• Ставка за лид: ${fmt.rub(m.currentLeadPrice)} (отказы — 0 руб.)
• Фикс за инфраструктуру: ${fmt.rubPerMonth(state.tariffFixPerMonth)} (${fmt.rub(m.fixTotal)} за весь срок)
• Общий бюджет проекта: ${fmt.rub(m.totalBudget)}

Порог окупаемости (защита от рисков):
При среднем чеке ${fmt.rub(state.dealCheck)} и марже ${state.marginPercent}% валовая прибыль со сделки составляет ${fmt.rub(m.profitPerDeal)}.
Для полной окупаемости проекта достаточно закрыть ВСЕГО ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} ${fmt.pluralLeads(m.leadsCount)} (порог конверсии всего ${m.breakEvenConversion}%). Все последующие закрытые сделки приносят чистую прибыль.
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

  const scenarioTitle = {
    pessimistic: 'Пессимистичный',
    medium: 'Средний',
    optimistic: 'Оптимистичный',
    custom: 'Индивидуальный'
  }[state.scenario] || 'Средний';

  const text = `
Выводы по проекту Call-Talk (${scenarioTitle} сценарий):

1. Прогноз продаж: при конверсии ${state.conversionPercent}% прогнозируется ${m.dealsCount} ${pluralDeals(m.dealsCount)}, ${fmt.rub(m.grossRevenue)} выручки, ${fmt.rub(m.grossRemaining)} остатка на счете за вычетом сервиса и +${fmt.rub(m.netProfit)} чистой прибыли сверх всех затрат (ROI ${fmt.pct(m.roi)}).
2. Защита от рисков: для 100% возврата бюджета достаточно закрыть всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} ${fmt.pluralLeads(m.leadsCount)} (порог конверсии всего ${m.breakEvenConversion}%).
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
  params.set('sc', state.scenario);
  params.set('lc', state.leadsCount);
  params.set('check', state.dealCheck);
  params.set('margin', state.marginPercent);
  params.set('conv', state.conversionPercent);
  if (state.ltvEnabled) {
    params.set('ltv', '1');
    params.set('ltvm', state.ltvMode);
    if (state.ltvMode === 'coeff') {
      params.set('ltvc', state.ltvCoeff);
    } else {
      params.set('rep', state.ltvRepeatDeals);
    }
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

  if (params.has('sc')) {
    const sc = params.get('sc');
    if (['pessimistic', 'medium', 'optimistic', 'custom'].includes(sc)) {
      state.scenario = sc;
    }
  }

  if (params.has('lc')) {
    const lc = parseInt(params.get('lc'), 10);
    if (lc > 0 && lc <= 50000) {
      state.leadsCount = lc;
      if (!params.has('sc')) {
        const pLeads = getScenarioLeads('pessimistic');
        const mLeads = getScenarioLeads('medium');
        const oLeads = getScenarioLeads('optimistic');
        if (lc === pLeads) state.scenario = 'pessimistic';
        else if (lc === mLeads) state.scenario = 'medium';
        else if (lc === oLeads) state.scenario = 'optimistic';
        else state.scenario = 'custom';
      }
    }
  } else {
    state.leadsCount = getScenarioLeads(state.scenario);
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
    if (params.has('ltvm')) {
      const mode = params.get('ltvm');
      if (mode === 'coeff' || mode === 'sub') state.ltvMode = mode;
    }
    if (params.has('ltvc')) {
      const c = parseFloat(params.get('ltvc'));
      if (c >= 1.0 && c <= 5.0) state.ltvCoeff = c;
    }
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
