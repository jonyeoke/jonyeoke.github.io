import sys
import subprocess
import os
import json

# [1. 라이브러리 자동 설치]
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("⚠️ google-genai 라이브러리가 없습니다. 자동 설치를 시작합니다...")
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "google-genai"])
    from google import genai
    from google.genai import types
    print("✅ 설치 완료!")

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

# [2. API Key 대화형 입력]
if "GOOGLE_API_KEY" not in os.environ:
    print("\n" + "=" * 50)
    print("🔑 Google Gemini API Key가 설정되지 않았습니다.")
    api_key_input = input("👉 API Key를 여기에 붙여넣고 엔터(Enter)를 누르세요: ").strip()
    os.environ["GOOGLE_API_KEY"] = api_key_input
    print("=" * 50 + "\n")

# Gemini 클라이언트 초기화
client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])

# FastAPI 앱 생성
app = FastAPI()

# [3. CORS 설정]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 입력 데이터 모델
class TripRequest(BaseModel):
    destination: str
    duration: str
    budget: str
    transport: List[str]
    style: str
    preference: str


@app.get("/")
def read_root():
    return {"message": "A.I.R 여행 플래너 서버가 정상 작동 중입니다! 🚀"}


# [4. 엔드포인트 구현 (Fallback 로직 적용)]
@app.post("/generate-trip-plan")
def generate_trip_plan(request: TripRequest):
    print(f"\n📨 요청 수신: {request.destination} ({request.duration}일)")

    # 시스템 프롬프트
    system_instruction = f"""
    당신은 20년 경력의 베테랑 'AI 여행 플래너'입니다.
    사용자의 입력 정보를 바탕으로 가장 효율적이고 현실적인 여행 계획을 세워주세요.

    [사용자 입력 정보]
    - 여행지: {request.destination}
    - 여행 기간: {request.duration}일
    - 예산(1인/1일): {request.budget}원
    - 이동 수단: {', '.join(request.transport)}
    - 여행 스타일: {request.style}
    - 추가 선호사항: {request.preference}

    [수행 미션]
    1. 예산 현실성 평가 (0~5점): 물가와 이동수단을 고려하여 냉정하게 점수를 매기세요.
    2. 동선 최적화: 이동 시간이 낭비되지 않도록 합리적인 순서로 배치하세요.
    3. 비용 계산: 각 활동별 예상 비용을 원화(KRW) 기준으로 추산하세요.
    4. 출력 형식 준수: 반드시 아래 JSON 스키마에 맞춰 응답하세요.
    5. 정확한 정보: 사실을 기반한 정확한 일정(장소, 시간, 비용 등)을 제시하세요.

    [JSON 응답 스키마]
    {{
        "title": "여행 제목 (재치있게)",
        "reality_score": 0~5 정수,
        "reality_reason": "점수 부여 사유",
        "total_estimated_cost": "총 예상 비용 (예: '약 45만 원')",
        "planner_comment": "전반적인 여행 조언",
        "daily_plans": [
            {{
                "day": 1,
                "date_theme": "1일차 테마",
                "activities": [
                    {{
                        "time": "오전/오후/저녁",
                        "place": "장소명",
                        "description": "활동 설명 (이동수단 포함)",
                        "icon": "이모지",
                        "cost": "예상 비용 (숫자와 '원')"
                    }}
                ]
            }}
        ]
    }}
    """

    # [핵심] 모델 Fallback 로직
    # 우선순위: 1. gemini-2.0-flash-exp -> 2. gemini-2.0-flash
    models_to_try = ['gemini-2.0-flash-exp', 'gemini-2.0-flash']

    for model_name in models_to_try:
        try:
            print(f"🔄 '{model_name}' 모델로 연결 시도 중...")

            response = client.models.generate_content(
                model=model_name,
                contents=system_instruction,
                config=types.GenerateContentConfig(
                    response_mime_type='application/json'))

            # 응답 파싱
            result = json.loads(response.text)
            print(f"✅ AI 응답 생성 완료! (사용된 모델: {model_name})")
            return result

        except Exception as e:
            # 실패 시 에러 로그를 출력하고 다음 모델로 넘어갑니다.
            print(f"⚠️ '{model_name}' 연결 실패: {str(e)}")
            print("   ↳ 다음 모델로 전환합니다...")
            continue

    # [모든 모델 실패 시]
    print("❌ 모든 AI 모델 연결에 실패했습니다.")
    return {
        "title": "오류 발생",
        "reality_score": 0,
        "reality_reason": "서버 통신량이 많아 AI 연결에 실패했습니다. 잠시 후 다시 시도해주세요.",
        "total_estimated_cost": "0원",
        "planner_comment": "모든 AI 모델이 응답하지 않습니다.",
        "daily_plans": []
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
