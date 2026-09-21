/**
 * Vessel-Weight Pro 2.0
 * Specialized Cargo Weighing & Tally Sheet Generator
 * Developed for Ports, Stevedores & Surveyors
 */

(function () {
  'use strict';

  // Конфигурация и состояние
  const STATE = {
    totalWeight: 0,
    totalUnits: 0,
    liftUnits: 0,
    surveyor1: null,
    surveyor2: null,
    scaleStep: 10,
    craneLimit: 10000,
    jitterRange: 40,
    vesselName: '',
    cargoType: '',
    lifts: [], // Массив объектов подъёмов
    calculated: false
  };

  // DOM Элементы
  const elements = {
    form: document.getElementById('vesselForm'),
    totalWeight: document.getElementById('totalWeight'),
    totalUnits: document.getElementById('totalUnits'),
    liftUnits: document.getElementById('liftUnits'),
    surveyor1: document.getElementById('surveyor1'),
    surveyor2: document.getElementById('surveyor2'),
    scaleStep: document.getElementById('scaleStep'),
    craneLimit: document.getElementById('craneLimit'),
    jitterRange: document.getElementById('jitterRange'),
    vesselName: document.getElementById('vesselName'),
    cargoType: document.getElementById('cargoType'),
    s1Hint: document.getElementById('s1Hint'),
    s2Hint: document.getElementById('s2Hint'),
    
    // Кнопки
    calcBtn: document.getElementById('calcBtn'),
    resetBtn: document.getElementById('resetBtn'),
    fillDemoBtn: document.getElementById('fillDemoBtn'),
    rerollBtn: document.getElementById('rerollBtn'),
    copyBtn: document.getElementById('copyBtn'),
    copyBtnText: document.getElementById('copyBtnText'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    printBtn: document.getElementById('printBtn'),
    copyCompactBtn: document.getElementById('copyCompactBtn'),
    themeToggleBtn: document.getElementById('themeToggleBtn'),

    // Панели
    resultsPanel: document.getElementById('resultsPanel'),
    placeholderPanel: document.getElementById('placeholderPanel'),
    surveyorBanner: document.getElementById('surveyorBanner'),
    surveyorBannerText: document.getElementById('surveyorBannerText'),

    // KPI
    kpiTotalWeight: document.getElementById('kpiTotalWeight'),
    kpiTargetMatch: document.getElementById('kpiTargetMatch'),
    kpiTotalLifts: document.getElementById('kpiTotalLifts'),
    kpiLiftsStructure: document.getElementById('kpiLiftsStructure'),
    kpiAvgUnitWeight: document.getElementById('kpiAvgUnitWeight'),
    kpiMinMaxLift: document.getElementById('kpiMinMaxLift'),
    kpiCraneLoadStatus: document.getElementById('kpiCraneLoadStatus'),

    // Таблица
    tallyTableBody: document.getElementById('tallyTableBody'),
    tableTotalUnits: document.getElementById('tableTotalUnits'),
    tableTotalWeight: document.getElementById('tableTotalWeight'),
    tableTotalAccum: document.getElementById('tableTotalAccum'),
    compactLiftString: document.getElementById('compactLiftString'),

    // Ошибки
    weightFeedback: document.getElementById('weightFeedback'),
    unitsFeedback: document.getElementById('unitsFeedback'),
    liftUnitsFeedback: document.getElementById('liftUnitsFeedback')
  };

  /**
   * Инициализация приложения
   */
  function init() {
    loadSavedTheme();
    loadSavedForm();
    bindEvents();
    updateSurveyorHints();
  }

  /**
   * Привязка событий
   */
  function bindEvents() {
    elements.form.addEventListener('submit', handleFormSubmit);
    elements.resetBtn.addEventListener('click', handleReset);
    elements.fillDemoBtn.addEventListener('click', handleFillDemo);
    elements.rerollBtn.addEventListener('click', () => calculateTally(true));
    elements.copyBtn.addEventListener('click', handleCopyTally);
    elements.copyCompactBtn.addEventListener('click', handleCopyCompact);
    elements.exportCsvBtn.addEventListener('click', handleExportCsv);
    elements.printBtn.addEventListener('click', handlePrint);
    elements.themeToggleBtn.addEventListener('click', toggleTheme);

    // Динамический пересчёт подсказок при вводе
    ['input', 'change'].forEach(evt => {
      elements.totalWeight.addEventListener(evt, onParamsChange);
      elements.totalUnits.addEventListener(evt, onParamsChange);
      elements.liftUnits.addEventListener(evt, onParamsChange);
      elements.scaleStep.addEventListener(evt, onParamsChange);
    });
  }

  /**
   * Реакция на изменение базовых параметров
   */
  function onParamsChange() {
    updateSurveyorHints();
    saveFormToStorage();
  }

  /**
   * Расчет и вывод подсказок для полей сюрвейеров
   */
  function updateSurveyorHints() {
    const weight = parseFloat(elements.totalWeight.value) || 0;
    const units = parseInt(elements.totalUnits.value, 10) || 0;
    const lift = parseInt(elements.liftUnits.value, 10) || 0;
    const step = parseInt(elements.scaleStep.value, 10) || 10;

    if (weight > 0 && units > 0 && lift > 0 && units >= lift) {
      const avgItem = weight / units;
      const expectedLiftWeight = Math.round((avgItem * lift) / step) * step;
      const hintText = `Ориентир для ${lift} шт: ~${formatNumber(expectedLiftWeight)} кг`;
      elements.s1Hint.textContent = hintText;
      elements.s2Hint.textContent = hintText;
    } else {
      elements.s1Hint.textContent = '';
      elements.s2Hint.textContent = '';
    }
  }

  /**
   * Округление до заданного шага (дискретности весов)
   */
  function roundToStep(num, step) {
    return Math.round(num / step) * step;
  }

  /**
   * Форматирование чисел с разделителем тысяч (12 500)
   */
  function formatNumber(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
  }

  /**
   * Обработка отправки формы
   */
  function handleFormSubmit(e) {
    e.preventDefault();
    if (!validateForm()) return;
    calculateTally(false);
  }

  /**
   * Валидация полей ввода с понятными сообщениями
   */
  function validateForm() {
    let isValid = true;
    clearFeedbacks();

    const weight = parseFloat(elements.totalWeight.value);
    const units = parseInt(elements.totalUnits.value, 10);
    const lift = parseInt(elements.liftUnits.value, 10);
    const step = parseInt(elements.scaleStep.value, 10) || 10;

    if (isNaN(weight) || weight <= 0) {
      showError(elements.totalWeight, elements.weightFeedback, 'Укажите положительный общий вес.');
      isValid = false;
    } else if (weight % step !== 0) {
      const nearest = Math.round(weight / step) * step;
      showErrorWithFix(elements.totalWeight, elements.weightFeedback, `Вес должен быть кратен ${step} кг (дискретность крановых весов).`, nearest);
      isValid = false;
    }

    if (isNaN(units) || units <= 0) {
      showError(elements.totalUnits, elements.unitsFeedback, 'Укажите количество связок/штук (> 0).');
      isValid = false;
    }

    if (isNaN(lift) || lift <= 0) {
      showError(elements.liftUnits, elements.liftUnitsFeedback, 'Укажите количество в подъёме (> 0).');
      isValid = false;
    } else if (units > 0 && lift > units) {
      showError(elements.liftUnits, elements.liftUnitsFeedback, 'Подъём не может превышать общее количество.');
      isValid = false;
    }

    // Проверка весов сюрвейеров, если заполнены (обязательно кратны 10 кг)
    const s1 = parseFloat(elements.surveyor1.value);
    if (!isNaN(s1)) {
      if (s1 <= 0) {
        showError(elements.surveyor1, elements.s1Hint, 'Вес сюрвейера 1 должен быть больше нуля.');
        isValid = false;
      } else if (s1 % step !== 0) {
        const nearestS1 = Math.round(s1 / step) * step;
        showErrorWithFix(elements.surveyor1, elements.s1Hint, `Вес сюрвейера 1 должен быть кратен ${step} кг.`, nearestS1);
        isValid = false;
      }
    }

    const s2 = parseFloat(elements.surveyor2.value);
    if (!isNaN(s2)) {
      if (s2 <= 0) {
        showError(elements.surveyor2, elements.s2Hint, 'Вес сюрвейера 2 должен быть больше нуля.');
        isValid = false;
      } else if (s2 % step !== 0) {
        const nearestS2 = Math.round(s2 / step) * step;
        showErrorWithFix(elements.surveyor2, elements.s2Hint, `Вес сюрвейера 2 должен быть кратен ${step} кг.`, nearestS2);
        isValid = false;
      }
    }

    return isValid;
  }

  function showError(inputEl, feedbackEl, message) {
    inputEl.classList.add('is-invalid');
    feedbackEl.textContent = message;
  }

  function showErrorWithFix(inputEl, feedbackEl, message, fixValue) {
    inputEl.classList.add('is-invalid');
    feedbackEl.innerHTML = `${message} <button type="button" class="btn-micro" style="margin-left:6px; color:#38bdf8; text-decoration:underline; background:none; border:none; cursor:pointer;" onclick="document.getElementById('${inputEl.id}').value = ${fixValue}; document.getElementById('${inputEl.id}').classList.remove('is-invalid'); this.parentElement.textContent='';">Округлить до ${formatNumber(fixValue)} кг</button>`;
  }

  function clearFeedbacks() {
    elements.totalWeight.classList.remove('is-invalid');
    elements.totalUnits.classList.remove('is-invalid');
    elements.liftUnits.classList.remove('is-invalid');
    elements.surveyor1.classList.remove('is-invalid');
    elements.surveyor2.classList.remove('is-invalid');
    elements.weightFeedback.textContent = '';
    elements.unitsFeedback.textContent = '';
    elements.liftUnitsFeedback.textContent = '';
  }

  /**
   * ЯДРО АЛГОРИТМА: Генерация и распределение весов подъёмов
   */
  function calculateTally(isReroll) {
    const totalWeight = parseFloat(elements.totalWeight.value);
    const totalUnits = parseInt(elements.totalUnits.value, 10);
    const liftUnits = parseInt(elements.liftUnits.value, 10);
    const step = parseInt(elements.scaleStep.value, 10) || 10;
    const maxJitter = parseInt(elements.jitterRange.value, 10);
    const craneLimit = parseFloat(elements.craneLimit.value) || 10000;

    const s1Value = parseFloat(elements.surveyor1.value);
    const hasS1 = !isNaN(s1Value) && s1Value > 0;
    const s2Value = parseFloat(elements.surveyor2.value);
    const hasS2 = !isNaN(s2Value) && s2Value > 0;

    // 1. Структура подъемов
    const mainLiftsCount = Math.floor(totalUnits / liftUnits); // Количество стандартных подъёмов
    const tailUnits = totalUnits % liftUnits;                  // Остаток (штук в неполном подъеме)
    const hasTail = tailUnits > 0;
    const totalLiftsCount = mainLiftsCount + (hasTail ? 1 : 0);

    const avgOneItemWeight = totalWeight / totalUnits;
    const stdLiftExpectedWeight = roundToStep(avgOneItemWeight * liftUnits, step);
    const tailLiftExpectedWeight = hasTail ? roundToStep(avgOneItemWeight * tailUnits, step) : 0;

    // 2. Учет сюрвейеров
    let surveyorLiftsCount = 0;
    if (hasS1) surveyorLiftsCount++;
    if (hasS2) surveyorLiftsCount++;

    if (surveyorLiftsCount > mainLiftsCount) {
      alert(`Невозможно назначить ${surveyorLiftsCount} замера сюрвейера: всего стандартных подъёмов ${mainLiftsCount}.`);
      return;
    }

    // Фиксированный вес (сюрвейеры + хвост)
    let fixedWeightSum = (hasS1 ? s1Value : 0) + (hasS2 ? s2Value : 0) + tailLiftExpectedWeight;
    let remainingWeight = totalWeight - fixedWeightSum;
    let remainingMainLifts = mainLiftsCount - surveyorLiftsCount;

    // 3. Распределение веса по оставшимся стандартным подъёмам
    let regularLiftsWeights = [];

    if (remainingMainLifts > 0) {
      const baseWeightPerLift = roundToStep(remainingWeight / remainingMainLifts, step);
      
      // Генерация набора случайных дельт, кратных шагу
      const possibleJitters = [];
      for (let j = -maxJitter; j <= maxJitter; j += step) {
        possibleJitters.push(j);
      }

      // Начальный стохастический массив
      for (let i = 0; i < remainingMainLifts; i++) {
        let jitter = 0;
        if (maxJitter > 0) {
          jitter = possibleJitters[Math.floor(Math.random() * possibleJitters.length)];
        }
        regularLiftsWeights.push(baseWeightPerLift + jitter);
      }

      // Корректировка разницы (чтобы сумма сошлась ровно в 0 кг с remainingWeight)
      let currentSum = regularLiftsWeights.reduce((a, b) => a + b, 0);
      let diff = remainingWeight - currentSum;

      // Равномерно размазываем diff шагами по 'step' по случайным подъемам
      while (diff !== 0) {
        const sign = diff > 0 ? step : -step;
        const randIdx = Math.floor(Math.random() * regularLiftsWeights.length);
        regularLiftsWeights[randIdx] += sign;
        diff -= sign;
      }
    }

    // 4. Сборка итогового списка подъёмов
    // Определим слоты для сюрвейеров (например, подъем #2 и подъем в середине)
    const s1Index = hasS1 ? (mainLiftsCount >= 3 ? 1 : 0) : -1;
    let s2Index = -1;
    if (hasS2) {
      s2Index = Math.min(Math.floor(mainLiftsCount / 2) + 1, mainLiftsCount - 1);
      if (s2Index === s1Index) s2Index = mainLiftsCount - 1;
    }

    const lifts = [];
    let regPointer = 0;

    for (let i = 0; i < mainLiftsCount; i++) {
      if (i === s1Index && hasS1) {
        lifts.push({
          num: i + 1,
          type: 'surveyor1',
          typeLabel: 'Сюрвейер 1',
          units: liftUnits,
          weight: s1Value,
          isSurveyor: true
        });
      } else if (i === s2Index && hasS2) {
        lifts.push({
          num: i + 1,
          type: 'surveyor2',
          typeLabel: 'Сюрвейер 2',
          units: liftUnits,
          weight: s2Value,
          isSurveyor: true
        });
      } else {
        lifts.push({
          num: i + 1,
          type: 'standard',
          typeLabel: 'Стандарт',
          units: liftUnits,
          weight: regularLiftsWeights[regPointer++],
          isSurveyor: false
        });
      }
    }

    // Добавляем хвостовой подъем при наличии
    if (hasTail) {
      // Проверка хвостового подъема на соответствие сумме
      const currentTotal = lifts.reduce((acc, l) => acc + l.weight, 0);
      const tailWeight = totalWeight - currentTotal;
      lifts.push({
        num: lifts.length + 1,
        type: 'tail',
        typeLabel: 'Остаток (хвост)',
        units: tailUnits,
        weight: tailWeight,
        isSurveyor: false
      });
    }

    // 5. Проверка баланса
    const finalSum = lifts.reduce((acc, l) => acc + l.weight, 0);
    const balanceDiff = totalWeight - finalSum;
    if (balanceDiff !== 0 && lifts.length > 0) {
      // Безопасная автокоррекция на не-сюрвейерский подъём
      const regularLift = lifts.find(l => !l.isSurveyor && l.type !== 'tail') || lifts[0];
      regularLift.weight += balanceDiff;
    }

    // Сохранение в состояние
    STATE.lifts = lifts;
    STATE.totalWeight = totalWeight;
    STATE.totalUnits = totalUnits;
    STATE.liftUnits = liftUnits;
    STATE.surveyor1 = hasS1 ? s1Value : null;
    STATE.surveyor2 = hasS2 ? s2Value : null;
    STATE.craneLimit = craneLimit;
    STATE.calculated = true;

    // 6. Отрисовка результатов
    renderResults(stdLiftExpectedWeight);
    saveFormToStorage();

    if (isReroll) {
      flashElement(elements.rerollBtn);
    }
  }

  /**
   * Отрисовка результатов и заполнение таблицы
   */
  function renderResults(stdExpectedWeight) {
    elements.placeholderPanel.style.display = 'none';
    elements.resultsPanel.style.display = 'block';

    const lifts = STATE.lifts;
    const totalWeight = lifts.reduce((a, b) => a + b.weight, 0);
    const totalUnits = lifts.reduce((a, b) => a + b.units, 0);
    const weightsOnly = lifts.map(l => l.weight);
    const minWeight = Math.min(...weightsOnly);
    const maxWeight = Math.max(...weightsOnly);

    // Заполнение KPI
    elements.kpiTotalWeight.textContent = `${formatNumber(totalWeight)} кг`;
    elements.kpiTargetMatch.textContent = `Баланс: ровно ${formatNumber(totalWeight)} кг`;

    const mainCount = lifts.filter(l => l.type !== 'tail').length;
    const tailCount = lifts.filter(l => l.type === 'tail').length;
    elements.kpiTotalLifts.textContent = lifts.length;
    elements.kpiLiftsStructure.textContent = `${mainCount} осн. + ${tailCount} ост.`;

    const avgUnitWeight = totalWeight / totalUnits;
    elements.kpiAvgUnitWeight.textContent = `${avgUnitWeight.toFixed(3)} кг`;

    elements.kpiMinMaxLift.textContent = `${formatNumber(minWeight)} — ${formatNumber(maxWeight)} кг`;

    if (maxWeight > STATE.craneLimit) {
      elements.kpiCraneLoadStatus.textContent = `⚠️ Превышение SWL (${formatNumber(STATE.craneLimit)} кг)`;
      elements.kpiCraneLoadStatus.style.color = '#ef4444';
    } else {
      elements.kpiCraneLoadStatus.textContent = `✓ В пределах SWL (${formatNumber(STATE.craneLimit)} кг)`;
      elements.kpiCraneLoadStatus.style.color = 'var(--text-success)';
    }

    // Плашка сюрвейеров
    if (STATE.surveyor1 || STATE.surveyor2) {
      elements.surveyorBanner.style.display = 'flex';
      const parts = [];
      if (STATE.surveyor1) parts.push(`Сюрвейер 1 = ${formatNumber(STATE.surveyor1)} кг`);
      if (STATE.surveyor2) parts.push(`Сюрвейер 2 = ${formatNumber(STATE.surveyor2)} кг`);
      elements.surveyorBannerText.textContent = parts.join(' | ');
    } else {
      elements.surveyorBanner.style.display = 'none';
    }

    // Отрисовка таблицы
    elements.tallyTableBody.innerHTML = '';
    let runningAccumWeight = 0;

    lifts.forEach(lift => {
      runningAccumWeight += lift.weight;
      const tr = document.createElement('tr');
      
      let rowClass = '';
      let pillClass = 'pill-std';
      if (lift.type === 'surveyor1') {
        rowClass = 'row-surveyor-1';
        pillClass = 'pill-s1';
      } else if (lift.type === 'surveyor2') {
        rowClass = 'row-surveyor-2';
        pillClass = 'pill-s2';
      } else if (lift.type === 'tail') {
        rowClass = 'row-tail';
        pillClass = 'pill-tail';
      }
      if (rowClass) tr.className = rowClass;

      // Дельта от номинала
      const expectedForThis = lift.type === 'tail' 
        ? Math.round(avgUnitWeight * lift.units) 
        : stdExpectedWeight;
      const diff = lift.weight - expectedForThis;
      let diffHtml = '';
      if (diff > 0) {
        diffHtml = `<span class="dev-indicator dev-plus">+${diff} кг</span>`;
      } else if (diff < 0) {
        diffHtml = `<span class="dev-indicator dev-minus">${diff} кг</span>`;
      } else {
        diffHtml = `<span class="dev-indicator dev-zero">0 кг</span>`;
      }

      tr.innerHTML = `
        <td class="col-num">#${lift.num}</td>
        <td class="col-type"><span class="type-pill ${pillClass}">${lift.typeLabel}</span></td>
        <td class="col-qty">${lift.units}</td>
        <td class="col-weight">${formatNumber(lift.weight)} кг</td>
        <td class="col-chart">${diffHtml}</td>
        <td class="col-accum">${formatNumber(runningAccumWeight)} кг</td>
      `;
      elements.tallyTableBody.appendChild(tr);
    });

    // Итоги таблицы
    elements.tableTotalUnits.textContent = totalUnits;
    elements.tableTotalWeight.textContent = `${formatNumber(totalWeight)} кг`;
    elements.tableTotalAccum.textContent = `${formatNumber(totalWeight)} кг (100%)`;

    // Компактная строка отвесов (3480, 3500, 3520...)
    elements.compactLiftString.textContent = lifts.map(l => l.weight).join(', ');

    // Скролл к результатам на смартфонах
    if (window.innerWidth <= 640) {
      elements.resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  /**
   * Копирование ведомости в буфер обмена для мессенджеров
   */
  function handleCopyTally() {
    if (!STATE.calculated || STATE.lifts.length === 0) return;

    const vessel = elements.vesselName.value.trim() || 'Судно / Партия';
    const cargo = elements.cargoType.value.trim() || 'Металлопрокат';
    const totalW = formatNumber(STATE.totalWeight);
    const date = new Date().toLocaleDateString('ru-RU');

    let text = `📋 КОНТРОЛЬНАЯ ПЕРЕВЕСКА (${date})\n`;
    text += `Объект: ${vessel} | Груз: ${cargo}\n`;
    text += `Итоговый вес: ${totalW} кг | Всего связок/шт: ${STATE.totalUnits}\n`;
    text += `Всего подъёмов: ${STATE.lifts.length} (по ${STATE.liftUnits} шт.)\n`;

    if (STATE.surveyor1 || STATE.surveyor2) {
      text += `Замеры инспекторов: `;
      if (STATE.surveyor1) text += `С1=${STATE.surveyor1}кг `;
      if (STATE.surveyor2) text += `С2=${STATE.surveyor2}кг `;
      text += `\n`;
    }

    text += `----------------------------------------\n`;
    text += `Ведомость отвесов (кг):\n`;
    STATE.lifts.forEach(l => {
      const tag = l.type === 'surveyor1' ? ' [Сюрв.1]' : (l.type === 'surveyor2' ? ' [Сюрв.2]' : (l.type === 'tail' ? ' [Хвост]' : ''));
      text += `#${l.num} (${l.units} шт): ${l.weight} кг${tag}\n`;
    });
    text += `----------------------------------------\n`;
    text += `ИТОГО: ${totalW} кг (Баланс 100% сошёлся)\n`;

    navigator.clipboard.writeText(text).then(() => {
      elements.copyBtnText.textContent = '✓ Скопировано!';
      setTimeout(() => {
        elements.copyBtnText.textContent = 'Скопировать текст';
      }, 2000);
    }).catch(err => {
      alert('Ошибка при копировании: ' + err);
    });
  }

  /**
   * Быстрое копирование чисел через запятую
   */
  function handleCopyCompact() {
    if (!STATE.calculated || STATE.lifts.length === 0) return;
    const str = STATE.lifts.map(l => l.weight).join(', ');
    navigator.clipboard.writeText(str).then(() => {
      elements.copyCompactBtn.textContent = '✓ Скопировано!';
      setTimeout(() => {
        elements.copyCompactBtn.textContent = 'Копировать список';
      }, 1500);
    });
  }

  /**
   * Экспорт таблицы в Excel CSV (с поддержкой кириллицы UTF-8 с BOM)
   */
  function handleExportCsv() {
    if (!STATE.calculated || STATE.lifts.length === 0) return;

    const vessel = elements.vesselName.value.trim() || 'Vessel';
    const cargo = elements.cargoType.value.trim() || 'Cargo';

    let csvContent = '\uFEFF'; // UTF-8 BOM для корректного открытия в Excel
    csvContent += `"Контрольная перевеска: ${vessel}";"Груз: ${cargo}";"Дата: ${new Date().toLocaleDateString('ru-RU')}"\n\n`;
    csvContent += `"№ подъема";"Тип подъема";"Кол-во связок/шт";"Вес подъема (кг)";"Накопительный итог (кг)"\n`;

    let accum = 0;
    STATE.lifts.forEach(l => {
      accum += l.weight;
      csvContent += `${l.num};"${l.typeLabel}";${l.units};${l.weight};${accum}\n`;
    });

    csvContent += `\n"ИТОГО";"Всего подъемов: ${STATE.lifts.length}";${STATE.totalUnits};${STATE.totalWeight};${accum}\n`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const cleanFileName = vessel.replace(/[^a-zA-Z0-9а-яА-Я_-]/g, '_');
    link.setAttribute('href', url);
    link.setAttribute('download', `Tally_${cleanFileName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Подготовка и запуск печати официального бланка
   */
  function handlePrint() {
    if (!STATE.calculated) return;

    const printContainer = document.getElementById('printSheet');
    const vessel = elements.vesselName.value.trim() || 'т/х «НЕ УКАЗАНО»';
    const cargo = elements.cargoType.value.trim() || 'Металлопрокат';
    const date = new Date().toLocaleString('ru-RU');

    let printHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px; line-height: 1.4;">
        <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="margin: 0; text-transform: uppercase;">АКТ КОНТРОЛЬНОЙ ПЕРЕВЕСКИ (ТАЛЬМАНСКИЙ ЛИСТ)</h2>
          <p style="margin: 5px 0 0; font-size: 11pt;">Судно / Объект: <strong>${vessel}</strong> | Груз: <strong>${cargo}</strong></p>
          <p style="margin: 2px 0 0; font-size: 9pt; color: #555;">Дата и время составления: ${date}</p>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 10pt;">
          <div><strong>Заявленный вес брутто:</strong> ${formatNumber(STATE.totalWeight)} кг</div>
          <div><strong>Всего связок / шт:</strong> ${STATE.totalUnits} шт.</div>
          <div><strong>Всего подъёмов:</strong> ${STATE.lifts.length}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 20px;" border="1">
          <thead>
            <tr style="background: #f0f0f0;">
              <th style="padding: 5px;">№</th>
              <th style="padding: 5px;">Тип подъёма</th>
              <th style="padding: 5px;">Связок/шт</th>
              <th style="padding: 5px;">Вес подъема (кг)</th>
              <th style="padding: 5px;">Накопительный итог (кг)</th>
              <th style="padding: 5px;">Подпись тальмана / сюрвейера</th>
            </tr>
          </thead>
          <tbody>
    `;

    let accum = 0;
    STATE.lifts.forEach(l => {
      accum += l.weight;
      printHtml += `
        <tr>
          <td style="padding: 4px; text-align: center;">${l.num}</td>
          <td style="padding: 4px;">${l.typeLabel}</td>
          <td style="padding: 4px; text-align: center;">${l.units}</td>
          <td style="padding: 4px; text-align: right; font-weight: bold;">${formatNumber(l.weight)}</td>
          <td style="padding: 4px; text-align: right;">${formatNumber(accum)}</td>
          <td style="padding: 4px; width: 140px;"></td>
        </tr>
      `;
    });

    printHtml += `
          </tbody>
          <tfoot>
            <tr style="font-weight: bold; background: #fafafa;">
              <td colspan="2" style="padding: 6px;">ИТОГО:</td>
              <td style="padding: 6px; text-align: center;">${STATE.totalUnits}</td>
              <td style="padding: 6px; text-align: right;">${formatNumber(STATE.totalWeight)} кг</td>
              <td style="padding: 6px; text-align: right;">${formatNumber(accum)} кг</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        <div style="margin-top: 30px; display: flex; justify-content: space-between; font-size: 10pt;">
          <div>Стивидор / Тальман: ____________________ (подпись)</div>
          <div>Сюрвейер инспекции: ____________________ (подпись)</div>
        </div>
      </div>
    `;

    printContainer.innerHTML = printHtml;
    window.print();
  }

  /**
   * Заполнение демо-данными
   */
  function handleFillDemo() {
    elements.vesselName.value = 'т/х «Baltic Navigator», Трюм №2';
    elements.cargoType.value = 'Арматура A500C d=25мм L=12м';
    elements.totalWeight.value = 148640;
    elements.totalUnits.value = 42;
    elements.liftUnits.value = 4;
    elements.scaleStep.value = 10;
    elements.craneLimit.value = 16000;
    elements.jitterRange.value = 40;

    // Рассчитаем ориентир и зададим реалистичные замеры сюрвейеров
    const avgItem = 148640 / 42;
    const stdLift = Math.round((avgItem * 4) / 10) * 10; // ~14160 кг
    elements.surveyor1.value = stdLift + 20; // 14180
    elements.surveyor2.value = stdLift - 30; // 14130

    updateSurveyorHints();
    clearFeedbacks();
    calculateTally(false);
  }

  /**
   * Сброс формы
   */
  function handleReset() {
    elements.form.reset();
    clearFeedbacks();
    elements.s1Hint.textContent = '';
    elements.s2Hint.textContent = '';
    elements.resultsPanel.style.display = 'none';
    elements.placeholderPanel.style.display = 'flex';
    STATE.calculated = false;
    STATE.lifts = [];
    localStorage.removeItem('vessel_weight_form_data');
  }

  /**
   * Переключение темы (Тёмная / Светлая)
   */
  function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('vessel_weight_theme', newTheme);
  }

  function loadSavedTheme() {
    const savedTheme = localStorage.getItem('vessel_weight_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  /**
   * Сохранение / восстановление формы
   */
  function saveFormToStorage() {
    const data = {
      totalWeight: elements.totalWeight.value,
      totalUnits: elements.totalUnits.value,
      liftUnits: elements.liftUnits.value,
      surveyor1: elements.surveyor1.value,
      surveyor2: elements.surveyor2.value,
      vesselName: elements.vesselName.value,
      cargoType: elements.cargoType.value,
      scaleStep: elements.scaleStep.value,
      craneLimit: elements.craneLimit.value,
      jitterRange: elements.jitterRange.value
    };
    localStorage.setItem('vessel_weight_form_data', JSON.stringify(data));
  }

  function loadSavedForm() {
    const raw = localStorage.getItem('vessel_weight_form_data');
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data.totalWeight) elements.totalWeight.value = data.totalWeight;
      if (data.totalUnits) elements.totalUnits.value = data.totalUnits;
      if (data.liftUnits) elements.liftUnits.value = data.liftUnits;
      if (data.surveyor1) elements.surveyor1.value = data.surveyor1;
      if (data.surveyor2) elements.surveyor2.value = data.surveyor2;
      if (data.vesselName) elements.vesselName.value = data.vesselName;
      if (data.cargoType) elements.cargoType.value = data.cargoType;
      if (data.scaleStep) elements.scaleStep.value = data.scaleStep;
      if (data.craneLimit) elements.craneLimit.value = data.craneLimit;
      if (data.jitterRange) elements.jitterRange.value = data.jitterRange;
    } catch (e) {
      console.warn('Не удалось загрузить данные из хранилища:', e);
    }
  }

  function flashElement(el) {
    el.style.transform = 'scale(0.95)';
    setTimeout(() => {
      el.style.transform = '';
    }, 150);
  }

  // Запуск при загрузке DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
