import { test, expect } from '@playwright/test';

test('기업회원 탭 클릭 시 기업회원 로그인 폼으로 전환됩니다.', async ({ page }) => {
  // 메인 페이지 접속
  await page.goto('https://m.albamon.com');

  await page.waitForTimeout(600);
  // 마이페이지 링크 클릭
  await page.getByRole('link', { name: ' 마이페이지' }).click();

  await page.waitForTimeout(600);
  // 기업회원 탭 클릭
  await page.getByRole('button', { name: '기업회원' }).click();

  await page.waitForTimeout(600);
  // URL 검증 (기업회원 로그인 폼으로 전환되었는지)
  await expect(page).toHaveURL(/.*memberType=CORPORATION/);

  await page.waitForTimeout(600);
  // 아이디 입력 필드가 보이는지 확인
  await expect(page.getByRole('textbox', { name: '' })).toBeVisible();

  await page.waitForTimeout(600);
  // 비밀번호 입력 필드가 보이는지 확인
  await expect(page.getByRole('textbox', { name: '' })).toBeVisible();
});