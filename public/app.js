/**
 * CALL-TALK ROI CALCULATOR
 * Core Application Logic & State Management
 * 
 * Rules strictly followed:
 * - NO ruble graphic sign: always "руб." or "руб./мес".
 * - Only use "база контактов" or "база в обработке".
 * - No daily letter limits.
 * - SQL meetings = x3 MQL price.
 */

// Formatters
const fmt = {
  num: (val) => new Intl.NumberFormat('ru-RU').format(Math.round(val)),
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
  tariffMonths: 4,       // 4 or 2
  tariffFixPerMonth: 39000,
  leadType: 'mql',       // 'mql' or 'sql'
  nicheLevel: 2,         // 1, 2, or 3
  customMqlPrice: null,  // if manual price set
  dealCheck: 1200000,    // average deal in rubles
  marginPercent: 20,     // net margin %
  conversionPercent: 15, // conversion from lead to closed deal %
  ltvEnabled: false,     // repeat purchases toggle
  ltvRepeatDeals: 2,     // repeat purchases count
  scenario: 'base'       // 'pessimistic', 'base', 'optimistic'
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
      { month: 1, name: '1-й месяц (прогрев + старт)', contacts: 600, emails: 1500, leadsMin: 9, leadsMax: 14, leadsAvg: 11 },
      { month: 2, name: '2-й месяц (масштабирование)', contacts: 1500, emails: 3750, leadsMin: 18, leadsMax: 27, leadsAvg: 22 },
      { month: 3, name: '3-й месяц (системный поток)', contacts: 1500, emails: 3750, leadsMin: 18, leadsMax: 27, leadsAvg: 22 },
      { month: 4, name: '4-й месяц (максимальный темп)', contacts: 1500, emails: 3750, leadsMin: 18, leadsMax: 27, leadsAvg: 23 }
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
      { month: 1, name: '1-й месяц (прогрев + старт)', contacts: 600, emails: 1500, leadsMin: 9, leadsMax: 14, leadsAvg: 11 },
      { month: 2, name: '2-й месяц (масштабирование)', contacts: 1500, emails: 3750, leadsMin: 18, leadsMax: 27, leadsAvg: 23 }
    ]
  }
};

// Base MQL Prices by Level
const LEVEL_MQL_PRICES = {
  1: 1800,
  2: 2800,
  3: 4800
};

// Niche Presets
const PRESETS = {
  metals: {
    name: 'Металлоконструкции',
    tariffMonths: 4,
    leadType: 'mql',
    nicheLevel: 2,
    dealCheck: 2500000,
    marginPercent: 18,
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
    marginPercent: 40,
    conversionPercent: 12,
    ltvEnabled: false,
    ltvRepeatDeals: 2
  },
  packaging: {
    name: 'Опт и упаковка',
    tariffMonths: 4,
    leadType: 'mql',
    nicheLevel: 1,
    dealCheck: 450000,
    marginPercent: 25,
    conversionPercent: 18,
    ltvEnabled: true,
    ltvRepeatDeals: 3
  },
  agro: {
    name: 'Спецтехника и станки',
    tariffMonths: 4,
    leadType: 'sql', // SQL meetings for high check!
    nicheLevel: 3,
    dealCheck: 6500000,
    marginPercent: 15,
    conversionPercent: 25,
    ltvEnabled: false,
    ltvRepeatDeals: 1
  },
  consulting: {
    name: 'Консалтинг и аудит',
    tariffMonths: 2,
    leadType: 'mql',
    nicheLevel: 2,
    dealCheck: 900000,
    marginPercent: 50,
    conversionPercent: 20,
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

  // Niche level cards
  levelCards: document.querySelectorAll('.level-card'),
  labelCurrentNicheLevel: document.getElementById('labelCurrentNicheLevel'),
  lvl1PriceVal: document.getElementById('lvl1PriceVal'),
  lvl2PriceVal: document.getElementById('lvl2PriceVal'),
  lvl3PriceVal: document.getElementById('lvl3PriceVal'),

  // Economics inputs & sliders
  dealCheckInput: document.getElementById('dealCheckInput'),
  dealCheckSlider: document.getElementById('dealCheckSlider'),
  dealCheckDisplay: document.getElementById('dealCheckDisplay'),
  quickCheckPills: document.querySelectorAll('.pill-btn[data-check]'),

  marginInput: document.getElementById('marginInput'),
  marginSlider: document.getElementById('marginSlider'),
  marginDisplay: document.getElementById('marginDisplay'),

  conversionInput: document.getElementById('conversionInput'),
  conversionSlider: document.getElementById('conversionSlider'),
  conversionDisplay: document.getElementById('conversionDisplay'),
  convHintText: document.getElementById('convHintText'),

  ltvToggle: document.getElementById('ltvToggle'),
  ltvSubpanel: document.getElementById('ltvSubpanel'),
  ltvSlider: document.getElementById('ltvSlider'),
  ltvMultiplierDisplay: document.getElementById('ltvMultiplierDisplay'),

  // Scenarios
  scenarioPills: document.querySelectorAll('.scenario-pill'),

  // Hero Stats
  heroRoiVal: document.getElementById('heroRoiVal'),
  heroNetProfitVal: document.getElementById('heroNetProfitVal'),
  heroRevenueVal: document.getElementById('heroRevenueVal'),
  heroBudgetVal: document.getElementById('heroBudgetVal'),
  heroCostShareVal: document.getElementById('heroCostShareVal'),

  // Break-even
  breakevenDescText: document.getElementById('breakevenDescText'),

  // Funnel & Stats Boxes
  statLeadsVal: document.getElementById('statLeadsVal'),
  statLeadsRange: document.getElementById('statLeadsRange'),
  statDealsVal: document.getElementById('statDealsVal'),
  statDealsProfit: document.getElementById('statDealsProfit'),
  statBudgetVal: document.getElementById('statBudgetVal'),
  statBudgetBreakdown: document.getElementById('statBudgetBreakdown'),
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

  // Lead format selection (MQL vs SQL x3)
  DOM.leadTypeMQL.addEventListener('click', () => {
    if (state.leadType !== 'mql') {
      state.leadType = 'mql';
      // If conversion was at SQL default (30%), set to MQL default (15%)
      if (state.conversionPercent >= 25) {
        state.conversionPercent = 15;
      }
      render();
    }
  });

  DOM.leadTypeSQL.addEventListener('click', () => {
    if (state.leadType !== 'sql') {
      state.leadType = 'sql';
      // If conversion was at MQL default (15%), suggest SQL default (30%)
      if (state.conversionPercent <= 18) {
        state.conversionPercent = 30;
      }
      render();
    }
  });

  // Niche Level Selection
  DOM.levelCards.forEach(card => {
    card.addEventListener('click', () => {
      state.nicheLevel = parseInt(card.dataset.level, 10);
      render();
    });
  });

  // Average Check Input & Slider
  DOM.dealCheckSlider.addEventListener('input', (e) => {
    state.dealCheck = parseInt(e.target.value, 10);
    suggestLevelByCheck(state.dealCheck);
    render();
  });

  DOM.dealCheckInput.addEventListener('change', (e) => {
    const val = fmt.cleanNum(e.target.value);
    state.dealCheck = Math.max(50000, Math.min(val, 50000000));
    suggestLevelByCheck(state.dealCheck);
    render();
  });

  DOM.quickCheckPills.forEach(pill => {
    pill.addEventListener('click', () => {
      state.dealCheck = parseInt(pill.dataset.check, 10);
      suggestLevelByCheck(state.dealCheck);
      render();
    });
  });

  // Margin %
  DOM.marginSlider.addEventListener('input', (e) => {
    state.marginPercent = parseInt(e.target.value, 10);
    render();
  });

  DOM.marginInput.addEventListener('change', (e) => {
    const val = parseInt(e.target.value, 10) || 20;
    state.marginPercent = Math.max(5, Math.min(val, 95));
    render();
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
        state.dealCheck = preset.dealCheck;
        state.marginPercent = preset.marginPercent;
        state.conversionPercent = preset.conversionPercent;
        state.ltvEnabled = preset.ltvEnabled;
        state.ltvRepeatDeals = preset.ltvRepeatDeals;
        
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
}

// Auto suggest niche level based on deal size if user hasn't explicitly chosen
function suggestLevelByCheck(check) {
  if (check >= 3000000 && state.nicheLevel < 3) {
    state.nicheLevel = 3;
  } else if (check >= 600000 && check < 3000000 && state.nicheLevel === 1) {
    state.nicheLevel = 2;
  }
}

// Calculate All Metrics
function calculateMetrics() {
  const tariffData = TARIFF_BENCHMARKS[state.tariffMonths];
  const isSql = state.leadType === 'sql';
  const multiplier = isSql ? 3 : 1;
  const currentLeadPrice = LEVEL_MQL_PRICES[state.nicheLevel] * multiplier;

  // Leads count based on scenario
  let leadsCount = tariffData.leadsAvg;
  let effectiveConv = state.conversionPercent;

  if (state.scenario === 'pessimistic') {
    leadsCount = tariffData.leadsMin;
    effectiveConv = Math.max(1, Math.round(state.conversionPercent * 0.8));
  } else if (state.scenario === 'optimistic') {
    leadsCount = tariffData.leadsMax;
    effectiveConv = Math.round(state.conversionPercent * 1.15);
  }

  // Deals
  const dealsCount = Math.max(1, Math.round(leadsCount * (effectiveConv / 100)));
  
  // Repeat deals multiplier
  const ltvFactor = state.ltvEnabled ? (1 + state.ltvRepeatDeals) : 1;

  // Economics
  const grossRevenue = dealsCount * state.dealCheck * ltvFactor;
  const grossProfit = grossRevenue * (state.marginPercent / 100);

  // Call-Talk Costs
  const fixTotal = state.tariffMonths * state.tariffFixPerMonth;
  const variableTotal = leadsCount * currentLeadPrice;
  const totalBudget = fixTotal + variableTotal;

  // Client Net Profit & ROI
  const netProfit = grossProfit - totalBudget;
  const roi = Math.round((netProfit / totalBudget) * 100);
  const costShare = ((totalBudget / grossRevenue) * 100).toFixed(1);
  const cac = Math.round(totalBudget / dealsCount);

  // Margin from single deal
  const profitPerDeal = state.dealCheck * (state.marginPercent / 100) * ltvFactor;
  const dealsToBreakEven = Math.max(1, Math.ceil(totalBudget / profitPerDeal));
  const breakEvenConversion = ((dealsToBreakEven / leadsCount) * 100).toFixed(1);

  return {
    tariffData,
    isSql,
    currentLeadPrice,
    leadsCount,
    dealsCount,
    effectiveConv,
    ltvFactor,
    grossRevenue,
    grossProfit,
    fixTotal,
    variableTotal,
    totalBudget,
    netProfit,
    roi,
    costShare,
    cac,
    profitPerDeal,
    dealsToBreakEven,
    breakEvenConversion
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

  // 2. Lead Type (MQL vs SQL x3)
  DOM.leadTypeMQL.classList.toggle('active', !m.isSql);
  DOM.leadTypeSQL.classList.toggle('active', m.isSql);
  DOM.labelLeadFormatNote.textContent = m.isSql ? 'Премиум-модель (x3)' : 'Базовая модель';

  // Dynamic price labels on cards
  const curBasePrice = LEVEL_MQL_PRICES[state.nicheLevel];
  DOM.mqlPriceText.textContent = `${fmt.num(curBasePrice)} руб. / лид`;
  DOM.sqlPriceText.textContent = `${fmt.num(curBasePrice * 3)} руб. / лид`;

  // 3. Niche Level Cards
  const mult = m.isSql ? 3 : 1;
  DOM.lvl1PriceVal.textContent = fmt.rub(LEVEL_MQL_PRICES[1] * mult);
  DOM.lvl2PriceVal.textContent = fmt.rub(LEVEL_MQL_PRICES[2] * mult);
  DOM.lvl3PriceVal.textContent = fmt.rub(LEVEL_MQL_PRICES[3] * mult);

  DOM.levelCards.forEach(card => {
    const lvl = parseInt(card.dataset.level, 10);
    card.classList.toggle('active', lvl === state.nicheLevel);
  });
  DOM.labelCurrentNicheLevel.textContent = `Уровень ${state.nicheLevel}`;

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

  DOM.conversionDisplay.textContent = `${state.conversionPercent}%`;
  DOM.conversionInput.value = state.conversionPercent;
  DOM.conversionSlider.value = state.conversionPercent;

  DOM.convHintText.textContent = m.isSql
    ? 'Для встреч (SQL) средний ориентир 25–40% (ЛПР уже согласился на предметный диалог/ТЗ).'
    : 'Для MQL средний ориентир 10–20% (ответ с подтвержденным интересом).';

  // LTV Toggle & Display
  DOM.ltvToggle.checked = state.ltvEnabled;
  DOM.ltvSubpanel.style.display = state.ltvEnabled ? 'block' : 'none';
  DOM.ltvSlider.value = state.ltvRepeatDeals;
  DOM.ltvMultiplierDisplay.textContent = `+${state.ltvRepeatDeals} ${pluralDeals(state.ltvRepeatDeals)} в год`;

  // Scenarios
  DOM.scenarioPills.forEach(pill => {
    pill.classList.toggle('active', pill.dataset.scenario === state.scenario);
  });

  // 5. Hero Stats
  DOM.heroRoiVal.textContent = fmt.pct(m.roi);
  DOM.heroRoiVal.style.color = m.roi >= 0 ? '#2DD4BF' : '#F87171';
  DOM.heroNetProfitVal.textContent = fmt.rub(m.netProfit);
  DOM.heroRevenueVal.textContent = fmt.rub(m.grossRevenue);
  DOM.heroBudgetVal.textContent = fmt.rub(m.totalBudget);
  DOM.heroCostShareVal.textContent = `~${m.costShare}%`;

  // 6. Break-Even Description
  DOM.breakevenDescText.innerHTML = `
    Клиенту достаточно закрыть <strong>всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)}</strong> из ${m.leadsCount} лидов 
    (конверсия <strong>${m.breakEvenConversion}%</strong>), чтобы полностью окупить весь бюджет проекта 
    в размере ${fmt.rub(m.totalBudget)}. 
    ${state.ltvEnabled ? 'Повторные заказы приносят 100% чистую прибыль без затрат на маркетинг.' : 'Каждая последующая сделка генерирует чистую прибыль.'}
  `;

  // 7. Funnel & Output Stat Boxes
  DOM.statLeadsVal.textContent = `${m.leadsCount} лидов`;
  DOM.statLeadsRange.textContent = `Диапазон: ${m.tariffData.leadsMin}–${m.tariffData.leadsMax} лидов`;

  DOM.statDealsVal.textContent = `${m.dealsCount} ${pluralDeals(m.dealsCount)}`;
  DOM.statDealsProfit.textContent = `Маржа со сделки: ${fmt.rub(m.profitPerDeal)}`;

  DOM.statBudgetVal.textContent = fmt.rub(m.totalBudget);
  DOM.statBudgetBreakdown.textContent = `Фикс ${fmt.rub(m.fixTotal)} + Лиды ${fmt.rub(m.variableTotal)}`;

  DOM.statCacVal.textContent = fmt.rub(m.cac);
  DOM.statCacCompare.textContent = `Приносит выручки: ${fmt.rub(state.dealCheck * m.ltvFactor)}`;

  // 8. Render Monthly Table
  renderMonthlyTable(m);

  // Sync state to URL without page reload
  syncStateToUrl();
}

// Pluralization helper for deals
function pluralDeals(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return 'сделок';
  if (mod10 === 1) return 'сделку';
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
    // Proportional leads for month based on scenario
    const monthRatio = row.leadsAvg / m.tariffData.leadsAvg;
    const monthLeads = Math.round(m.leadsCount * monthRatio);
    const monthDeals = Math.max(1, Math.round(monthLeads * (m.effectiveConv / 100)));
    
    // Cost per month: infrastructure fix + leads cost
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

  // Total summary row
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
  const formatName = m.isSql ? 'SQL (квалифицированные встречи с ЛПР под ТЗ)' : 'MQL (лиды с подтвержденным интересом)';

  const text = `
🎯 Расчет окупаемости лидогенерации Call-Talk:

• Срок договора: ${state.tariffMonths} месяца
• База в обработке: ${fmt.num(m.tariffData.totalBaseContacts)} целевых контактов
• Формат лидов: ${formatName}
• Ставка за лид: ${fmt.rub(m.currentLeadPrice)} (отказы и спам не оплачиваются)
• Фикс за инфраструктуру: ${fmt.rubPerMonth(state.tariffFixPerMonth)} (${fmt.rub(m.fixTotal)} за весь период)

📊 Прогноз воронки и результатов:
• Прогноз лидов: ${m.leadsCount} (вилка ${m.tariffData.leadsMin}–${m.tariffData.leadsMax} лидов)
• Конверсия в сделку: ${m.effectiveConv}%
• Прогноз закрытых сделок: ${m.dealsCount} ${pluralDeals(m.dealsCount)}
• Средний чек сделки: ${fmt.rub(state.dealCheck)} (маржинальность ${state.marginPercent}%)

💰 Финансовая экономика:
• Ожидаемая выручка: ${fmt.rub(m.grossRevenue)}
• Чистая прибыль клиента: ${fmt.rub(m.netProfit)}
• Общие инвестиции в Call-Talk: ${fmt.rub(m.totalBudget)}
• Окупаемость (ROI): ${fmt.pct(m.roi)}
• Доля расходов на маркетинг: составляет ~${m.costShare}% от привлеченной выручки

🛡️ Точка безубыточности:
Вам достаточно закрыть всего ${m.dealsToBreakEven} ${pluralDeals(m.dealsToBreakEven)} из ${m.leadsCount} лидов (конверсия всего ${m.breakEvenConversion}%), чтобы полностью окупить весь ${state.tariffMonths}-месячный бюджет проекта. Все последующие сделки приносят чистую прибыль.
  `.trim();

  navigator.clipboard.writeText(text).then(() => {
    showToast('Текст расчета скопирован в буфер обмена!');
  }).catch(() => {
    showToast('Ошибка копирования. Выделите текст вручную.');
  });
}

// Copy Shareable URL with Current Parameters
function copyShareableLink() {
  const url = window.location.href;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Ссылка с вашими параметрами скопирована!');
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
  if (params.has('chk')) state.dealCheck = parseInt(params.get('chk'), 10) || 1200000;
  if (params.has('mg')) state.marginPercent = parseInt(params.get('mg'), 10) || 20;
  if (params.has('cv')) state.conversionPercent = parseInt(params.get('cv'), 10) || 15;
  if (params.has('ltv')) state.ltvEnabled = params.get('ltv') === '1';
  if (params.has('ltvc')) state.ltvRepeatDeals = parseInt(params.get('ltvc'), 10) || 2;
  if (params.has('sc')) state.scenario = params.get('sc');

  state.tariffFixPerMonth = state.tariffMonths === 4 ? 39000 : 56000;
}

// Boot
window.addEventListener('DOMContentLoaded', init);
