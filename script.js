// [핵심 요구사항] API 서버 주소 정의 (현재는 빈 값)
const SERVER_URL = '';

// DOM 요소 가져오기
const durationInput = document.getElementById('duration');
const budgetInput = document.getElementById('budget');
const durationCheck = document.getElementById('durationCheck');
const budgetCheck = document.getElementById('budgetCheck');
const submitBtn = document.getElementById('submitBtn');
const placeholder = document.getElementById('placeholder');
const loader = document.getElementById('loader');
const resultContent = document.getElementById('resultContent');

// 1. 기간 입력 시 실시간 'N박 N일' 변환 로직
durationInput.addEventListener('input', function() {
    const val = parseInt(this.value);
    if (val && val > 0) {
        const nights = val - 1;
        durationCheck.textContent = nights === 0 ? `(당일치기)` : `(${nights}박 ${val}일)`;
    } else {
        durationCheck.textContent = "";
    }
});

// 2. 예산 입력 시 실시간 한글 금액 변환 로직
budgetInput.addEventListener('input', function() {
    const val = parseInt(this.value);
    if (val && val > 0) {
        budgetCheck.textContent = `(${formatKoreanMoney(val)})`;
    } else {
        budgetCheck.textContent = "";
    }
});

// [핵심] 금액을 한글로 바꾸는 헬퍼 함수
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

// 버튼 클릭 이벤트 리스너
submitBtn.addEventListener('click', function() {
    register();
});

// 서버 통신 및 로직 처리를 담당하는 register 함수
function register() {
    // 1. 입력 데이터 수집
    const dest = document.getElementById('destination').value;
    const duration = document.getElementById('duration').value;
    const budget = document.getElementById('budget').value;
    const style = document.getElementById('style').value;
    const preference = document.getElementById('preference').value;

    // 체크박스 값 수집
    const transportCheckboxes = document.querySelectorAll('input[name="transport"]:checked');
    const selectedTransports = Array.from(transportCheckboxes).map(cb => cb.value);

    // 2. 유효성 검사
    if (!dest || !duration || !budget) {
        alert("여행지, 기간, 예산은 필수 입력 사항입니다!");
        return;
    }
    if (selectedTransports.length === 0) {
        alert("이동 수단을 최소 1개 이상 선택해주세요!");
        return;
    }

    // 3. UI 상태 변경 (로딩 시작)
    placeholder.style.display = 'none';
    resultContent.style.display = 'none';
    loader.style.display = 'block';

    // 4. 서버로 보낼 데이터 객체 생성
    const requestData = {
        destination: dest,
        duration: duration,
        budget: budget,
        transport: selectedTransports,
        style: style,
        preference: preference
    };

    // fetch 통신 시도
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
        loader.style.display = 'none';
        // [수정] Flex 적용을 위해 block 대신 flex 사용
        resultContent.style.display = 'flex';
        renderResult(data);
    })
    .catch(error => {
        console.warn("서버 통신 실패 (Demo 모드로 전환):", error);

        // [데모용] 가짜 데이터 생성 및 렌더링
        setTimeout(() => {
            const mockResponse = generateDynamicMockResponse(dest, duration, budget, selectedTransports);
            loader.style.display = 'none';
            // [수정] Flex 적용을 위해 block 대신 flex 사용
            resultContent.style.display = 'flex';
            renderResult(mockResponse);
        }, 1500);
    });
}

// 화면에 결과를 그려주는 함수 (Render)
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

    if (data.daily_plans && data.daily_plans.length > 0) {
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
                            <div class="act-cost">${act.cost}원</div>
                        </div>`;
                });
            }
            html += `</div>`;
        });
    }

    html += `</div>`;
    resultContent.innerHTML = html;
}

// [데모용] 동적 데이터 생성 함수
function generateDynamicMockResponse(destination, duration, budget, transports) {
    const isLowBudget = budget < 100000;
    const transportStr = transports.join(', ');
    const days = parseInt(duration);

    // [수정] 총 비용 계산 및 한글 포맷팅 적용
    const rawTotalCost = isLowBudget ? (days * budget) + 100000 : (days * budget);
    const formattedTotalCost = "약 " + formatKoreanMoney(rawTotalCost);

    let dailyPlans = [];
    for(let i=1; i<=days; i++) {
        dailyPlans.push({
            "day": i,
            "date_theme": `${i}일차 ${destination} 탐방`,
            "activities": [
                {
                    "time": "오전 10:00",
                    "place": `${destination} 명소 ${i}`,
                    "description": `${transports[i % transports.length] || '도보'}로 이동하여 관람합니다.`,
                    "icon": "🚩",
                    "cost": isLowBudget ? "0" : "15,000"
                },
                {
                    "time": "오후 2:00",
                    "place": `${i}일차 맛집`,
                    "description": "현지 음식을 즐기며 휴식.",
                    "icon": "🍜",
                    "cost": isLowBudget ? "10,000" : "25,000"
                },
                {
                    "time": "오후 7:00",
                    "place": `${i}일차 야경 스팟`,
                    "description": "하루를 마무리하는 야경 감상.",
                    "icon": "✨",
                    "cost": "5,000"
                }
            ]
        });
    }

    return {
        "title": `[A.I.R] ${destination} ${days-1}박 ${days}일 플랜`,
        "reality_score": isLowBudget ? 2 : 5,
        "reality_reason": isLowBudget
            ? `입력하신 예산은 ${destination}의 물가를 고려할 때 다소 부족합니다.`
            : `예산과 일정이 아주 적절합니다. 즐거운 여행 되세요!`,
        // [수정] 위에서 포맷팅한 한글 금액 사용
        "total_estimated_cost": formattedTotalCost,
        "planner_comment": `요청하신 ${days}일 동안의 일정을 ${transportStr} 이동수단을 고려하여 최적화했습니다.`,
        "daily_plans": dailyPlans
    };
}