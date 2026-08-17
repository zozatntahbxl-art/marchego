import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#3d7c2c',
          color: '#faf7ec',
          fontSize: 100,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
        }}
      >
        M
      </div>
    ),
    { ...size },
  );
}
