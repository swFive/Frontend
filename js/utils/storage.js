(function (global) {
  // 중앙 저장소 유틸 모듈
  // MediStorage.keys: 사용되는 localStorage 키 집합
  // MediStorage.getMedicationCards() / saveMedicationCards(cards)
  // MediStorage.getManualHistory() / saveManualHistory(history)
  // MediStorage.getManualGroups() / saveManualGroups(groups)

  const STORAGE_KEYS = {
    medicationCards: 'medicationCards',
    manualHistory: 'manualIntakeHistory',
    manualGroups: 'manualIntakeGroups',
  };

  /**
   * localStorage JSON 읽기 (파싱 실패/없음 시 fallback 반환)
   * @param {string} key localStorage 키
   * @param {*} fallback 기본값
   * @returns {*} 파싱 결과 또는 fallback
   */
  function readJSON(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return cloneFallback(fallback);
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`[MediStorage] Failed to read ${key}:`, error);
      return cloneFallback(fallback);
    }
  }

  /**
   * localStorage JSON 저장 (실패 시 경고)
   * @param {string} key localStorage 키
   * @param {*} value 저장할 값
   */
  function writeJSON(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`[MediStorage] Failed to write ${key}:`, error);
    }
  }

  /**
   * fallback 복제 (배열/객체 얕은 복사)
   * @param {*} value 원본
   * @returns {*} 복제본 또는 원시값 그대로
   */
  function cloneFallback(value) {
    if (Array.isArray(value)) return value.slice();
    if (value && typeof value === 'object') return { ...value };
    return value;
  }

  const api = {
    keys: STORAGE_KEYS,
    /** 약 카드 배열 조회 */
    getMedicationCards() {
      return readJSON(STORAGE_KEYS.medicationCards, []);
    },
    /** 약 카드 배열 저장 */
    saveMedicationCards(cards) {
      writeJSON(STORAGE_KEYS.medicationCards, Array.isArray(cards) ? cards : []);
    },
    /** 수동 복용 히스토리 조회 (일자별 객체) */
    getManualHistory() {
      return readJSON(STORAGE_KEYS.manualHistory, {});
    },
    /** 수동 복용 히스토리 저장 */
    saveManualHistory(history) {
      writeJSON(
        STORAGE_KEYS.manualHistory,
        history && typeof history === 'object' ? history : {}
      );
    },
    /** 수동 복용 그룹(배열) 조회 */
    getManualGroups() {
      return readJSON(STORAGE_KEYS.manualGroups, []);
    },
    /** 수동 복용 그룹 저장 */
    saveManualGroups(groups) {
      writeJSON(STORAGE_KEYS.manualGroups, Array.isArray(groups) ? groups : []);
    },
  };

  // 전역 바인딩
  global.MediStorage = api;
})(typeof window !== 'undefined' ? window : globalThis);
