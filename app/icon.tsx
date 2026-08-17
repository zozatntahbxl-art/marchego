import { ImageResponse } from 'next/og';

export const size = { width: 192, height: 192 };
export const contentType = 'image/png';

export default function Icon() {
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
          fontSize: 110,
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
