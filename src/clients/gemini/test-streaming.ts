/**
 * Gemini 스트리밍 테스트 파일
 */

import GeminiClient from './client';

async function testStreaming() {
  console.log('🚀 Gemini 스트리밍 테스트 시작\n');
  
  try {
    const client = new GeminiClient();
    console.log('✅ 클라이언트 생성됨');
    console.log('📋 사용 모델:', client['config'].model);
    
    let fullResponse = '';
    let chunkCount = 0;
    
    console.log('\n📤 스트리밍 요청 시작...\n');
    
    const response = await client.sendStream(
      '한국의 역사에 대해 자세히 설명해주세요. 최소 500자 이상으로 작성해주세요.',
      (chunk) => {
        chunkCount++;
        if (chunk.error) {
          console.log('❌ 에러:', chunk.error);
        } else if (chunk.done) {
          console.log('\n✅ 스트리밍 완료');
          console.log(`📊 총 ${chunkCount}개 청크 처리됨`);
        } else {
          process.stdout.write(chunk.text);
          fullResponse += chunk.text;
        }
      }
    );
    
    console.log('\n📝 전체 응답 길이:', fullResponse.length);
    console.log('📝 전체 응답:', fullResponse);
    
    if (response.error) {
      console.log('❌ 최종 에러:', response.error);
    } else {
      console.log('✅ 테스트 성공!');
    }
    
  } catch (error) {
    console.log('❌ 테스트 실패:', error);
  }
}

// 테스트 실행
testStreaming();
