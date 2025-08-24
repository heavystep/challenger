import { test, expect } from '@playwright/test';

test('아이디 및 비밀번호 입력 필드가 존재하며 상호작용할 수 있습니다.', async ({ page }) => {
  // 메인 페이지 접속
  await page.goto('https://m.albamon.com');

  await page.waitForTimeout(600);
  // 마이페이지 버튼 클릭
  await page.getByRole('link', { name: ' 마이페이지' }).click();

  await page.waitForTimeout(600);
  // 아이디 입력 필드 확인 및 입력
  await expect(page.getByRole('textbox', { name: '' })).toBeVisible();
  await page.getByRole('textbox', { name: '' }).fill('test_id');

  await page.waitForTimeout(600);
  // 비밀번호 입력 필드 확인 및 입력
  await expect(page.getByRole('textbox', { name: '' })).toBeVisible();
  await page.getByRole('textbox', { name: '' }).fill('test_password');
});