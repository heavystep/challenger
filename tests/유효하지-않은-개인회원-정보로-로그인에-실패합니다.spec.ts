import { test, expect } from '@playwright/test';

test('유효하지 않은 개인회원 정보로 로그인에 실패합니다.', async ({ page }) => {
  // 메인 페이지 접속
  await page.goto('https://m.albamon.com');

  await page.waitForTimeout(600);
  // 마이페이지 버튼 클릭
  await page.getByRole('link', { name: ' 마이페이지' }).click();

  await page.waitForTimeout(600);
  // 로그인 페이지 URL 검증
  await expect(page).toHaveURL(/.*login/);

  await page.waitForTimeout(600);
  // 아이디 입력
  await page.getByRole('textbox', { name: '' }).fill('invalid_id');

  await page.waitForTimeout(600);
  // 비밀번호 입력
  await page.getByRole('textbox', { name: '' }).fill('invalid_password');

  await page.waitForTimeout(600);
  // 로그인 버튼 클릭
  await page.getByRole('button', { name: '로그인', exact: true }).click();

  await page.waitForTimeout(600);
  // 로그인 실패 메시지 확인
  await expect(page.getByText('연속된 로그인 실패로 로그인이 일시적으로 차단되었습니다.')).toBeVisible();
});