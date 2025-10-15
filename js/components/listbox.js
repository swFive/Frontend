const btn = document.querySelector(".main__listbox__list__btnbox__btn");

console.log("버튼 전체:", btn.className);

btn.addEventListener("click",function(){
    btn.style.background = "black";

    alert(btn.style.background);
});