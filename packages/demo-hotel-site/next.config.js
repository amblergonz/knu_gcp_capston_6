/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  // dev 서버가 도는 중에 build 를 돌리면 같은 .next 를 덮어써서
  // 실행 중인 dev 의 모듈 그래프가 깨진다(__webpack_modules__[id] is not a function).
  // 검증용 빌드는 NEXT_DIST_DIR=.next-build 로 분리한다.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // 모노레포 상위에 다른 lockfile 이 있어 워크스페이스 루트 추론 경고가 뜬다.
  outputFileTracingRoot: __dirname,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
};
