// 검색창 컴포넌트 동작 스크립트
// - 모바일(639px 이하)에서만 표시(CSS 미디어쿼리)
// - 검색 버튼 클릭 시 상단 바 슬라이드 다운, 닫기 시 슬라이드 업
export function initSearchBar() {
  const searchBtn = document.getElementById('searchBtn');
  const searchBar = document.getElementById('searchBar');
  const closeSearch = document.getElementById('closeSearch');
  const searchInput = document.getElementById('searchInput');
  const searchForm = document.getElementById('searchForm');
  // 필수 요소가 없으면 초기화 생략
  if (!(searchBtn && searchBar && closeSearch && searchInput && searchForm)) return;

  // 열기: show 클래스 추가 후 포커스 보정
  searchBtn.addEventListener('click', function(e) {
    e.preventDefault();
    searchBar.classList.remove('hide');
    searchBar.classList.add('show');
    // 모바일에서 키보드 표시를 위해 약간 지연 후 포커스 2회 시도
    setTimeout(() => {
      searchInput.focus();
      setTimeout(() => searchInput.focus(), 100);
    }, 50);
  });

  // 닫기: hide 클래스로 전환(애니메이션 시간 이후 입력값 초기화)
  closeSearch.addEventListener('click', function() {
    searchBar.classList.remove('show');
    searchBar.classList.add('hide');
    setTimeout(() => {
      searchInput.value = '';
    }, 350);
  });

  // submit 방지 (엔터 입력 시 페이지 이동 방지)
  searchForm.addEventListener('submit', function(e){
    e.preventDefault();
  });
}
