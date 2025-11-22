(function (global) {
  // 공통 날짜 유틸 모듈
  // MediCommon.getTodayDateString(): 오늘 날짜를 'YYYY-MM-DD' 문자열로 반환
  // MediCommon.formatDate(date): Date 객체를 'YYYY-MM-DD' 문자열로 변환

  /**
   * 오늘 날짜를 'YYYY-MM-DD' 포맷으로 반환
   * @returns {string} YYYY-MM-DD
   */
  function getTodayDateString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /**
   * Date 객체 -> 'YYYY-MM-DD'
   * @param {Date} date 변환할 Date
   * @returns {string} YYYY-MM-DD
   */
  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 외부에서 사용 가능한 API 바인딩
  global.MediCommon = { getTodayDateString, formatDate };
})(typeof window !== 'undefined' ? window : globalThis);
