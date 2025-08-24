# @heavystep/challenger

# TL;DR

| [![RQ-z5f2nBsc](http://img.youtube.com/vi/RQ-z5f2nBsc/0.jpg)](https://youtu.be/RQ-z5f2nBsc) |
|---|

[✨ Notion에서 스토리 감상](https://heavystep.notion.site/ai-challenge-qa)

# 직접 굴려보기
```shell
git clone https://github.com/heavystep/challenger
cd challenger
yarn
yarn run init
yarn run dev
```

# 상세

- 모델: `gemini-2.5-flash`
- 프롬프트
  - [`gen`](https://github.com/heavystep/challenger/blob/master/src/prompts/genPrompt.ts)
  - [`run`](https://github.com/heavystep/challenger/blob/master/src/prompts/runPrompt.ts)
- 응답 예시 (= 자동화 스크립트)
  - [시나리오: 알바몬 모바일 웹 로그인](https://github.com/heavystep/challenger/blob/master/tests/m-albamon-com-로그인.json)
  - Playwright 스크립트
    - [TC1: 로그인 폼과 인터랙션할 수 있습니다.](https://github.com/heavystep/challenger/blob/master/tests/아이디-및-비밀번호-입력-필드가-존재하며-상호작용할-수-있습니다.spec.ts)
    - [TC2: 기업회원 탭 클릭 시 폼이 바뀝니다.](https://github.com/heavystep/challenger/blob/master/tests/기업회원-탭-클릭-시-기업회원-로그인-폼으로-전환됩니다.spec.ts)
    - [TC3: 올바르지 않은 ID/PW로 로그인 시도 시 실패합니다.](https://github.com/heavystep/challenger/blob/master/tests/유효하지-않은-개인회원-정보로-로그인에-실패합니다.spec.ts)
> 상기 예시들은 이 에이전트로 생성한 정말 '예시'일 뿐, 이 앱은 특정 서비스나 시나리오에 종속성을 갖지 않습니다.
> 직접 클론해서 테스트해보셔요!! 😆
