const SERVER_URL = 'https://1f4dc10b-3305-4ea9-a554-9ea67d3e654d-00-2foe5e4fdcyj0.pike.replit.dev/register';

// DOM 요소
const durationInput = document.getElementById('duration');
const budgetInput = document.getElementById('budget');
const durationCheck = document.getElementById('durationCheck');
const budgetCheck = document.getElementById('budgetCheck');
const submitBtn = document.getElementById('submitBtn');
const placeholder = document.getElementById('placeholder');
const loader = document.getElementById('loader');
const resultContent = document.getElementById('resultContent');

// 1. 기간 실시간 표시
durationInput.addEventListener('input', function() {
    const val = parseInt(this.value);
    if (val && val > 0) {
        const nights = val - 1;
        durationCheck.textContent = nights === 0 ? `(당일치기)` : `(${nights}박 ${val}일)`;
    } else { durationCheck.textContent = ""; }
});

// 2. 예산 실시간 표시
budgetInput.addEventListener('input', function() {
    const val = parseInt(this.value);
    if (val && val > 0) {
        budgetCheck.textContent = `(${formatKoreanMoney(val)})`;
    } else { budgetCheck.textContent = ""; }
});

// [Helper] 금액 한글 변환 함수
function formatKoreanMoney(num) {
    if (num < 10000) return num.toLocaleString() + "원";
    const unit = ["", "만", "억", "조"];
    let str = "";
    let splitUnit = 10000;
    let curr = num;
    for (let i = 0; i < unit.length; i++) {
        let div = Math.floor(curr % splitUnit);
        curr = Math.floor(curr / splitUnit);
        if (div > 0) str = div.toLocaleString() + unit[i] + " " + str;
    }
    return str.trim() + "원";
}

submitBtn.addEventListener('click', function() { register(); });

function register() {
    const dest = document.getElementById('destination').value;
    const duration = document.getElementById('duration').value;
    const budget = document.getElementById('budget').value;
    const style = document.getElementById('style').value;
    const preference = document.getElementById('preference').value;
    const transportCheckboxes = document.querySelectorAll('input[name="transport"]:checked');
    const selectedTransports = Array.from(transportCheckboxes).map(cb => cb.value);

    if (!dest || !duration || !budget) { alert("여행지, 기간, 예산은 필수 입력 사항입니다!"); return; }
    if (selectedTransports.length === 0) { alert("이동 수단을 최소 1개 이상 선택해주세요!"); return; }

    placeholder.style.display = 'none';
    resultContent.style.display = 'none';
    loader.style.display = 'block';

    const requestData = { destination: dest, duration: duration, budget: budget, transport: selectedTransports, style: style, preference: preference };

    fetch(SERVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        // [성공 시] 실제 AI 데이터 렌더링
        loader.style.display = 'none';
        resultContent.style.display = 'flex';
        renderResult(data);
    })
    .catch(error => {
        // [실패 시] 가짜 데이터 생성 로직 삭제함 -> 명확한 에러 알림
        console.error("서버 통신 오류:", error);
        loader.style.display = 'none';
        placeholder.style.display = 'block'; // 다시 안내 문구 표시
        alert("⚠️ 서버 연결에 실패했습니다.\n1. Replit 서버가 켜져 있는지 확인하세요.\n2. 서버 주소 끝에 /register 가 있는지 확인하세요.\n(개발자 도구 Console 창에서 상세 에러를 볼 수 있습니다.)");
    });
}

function renderResult(data) {
    let scoreClass = 'score-mid';
    if(data.reality_score >= 4) scoreClass = 'score-high';
    if(data.reality_score <= 2) scoreClass = 'score-low';

    let html = `
        <div class="result-header">
            <div class="trip-title">${data.title}</div>
            <span class="reality-badge ${scoreClass}">현실성 점수: ${data.reality_score} / 5.0</span>
            <div class="total-cost">총 예상 비용: ${data.total_estimated_cost}</div>
        </div>
        <div class="planner-comment">
            <strong>💡 Planner's Comment:</strong><br>${data.planner_comment}<br><br>
            <small style="color:${data.reality_score < 3 ? 'red' : 'green'}">*판단 근거: ${data.reality_reason}</small>
        </div>
        <div class="timeline">
    `;

    if (data.daily_plans) {
        data.daily_plans.forEach(dayPlan => {
            html += `<div class="day-block"><div class="day-marker"></div><div class="day-title">Day ${dayPlan.day}: ${dayPlan.date_theme}</div>`;
            if (dayPlan.activities) {
                dayPlan.activities.forEach(act => {
                    html += `
                        <div class="activity-card">
                            <div class="act-icon">${act.icon}</div>
                            <div class="act-info">
                                <div class="act-time">${act.time}</div>
                                <div class="act-name">${act.place}</div>
                                <div class="act-desc">${act.description}</div>
                            </div>
                            <div class="act-cost">${act.cost}</div>
                        </div>`;
                });
            }
            html += `</div>`;
        });
    }
    html += `</div>`;
    resultContent.innerHTML = html;
}