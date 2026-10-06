import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { Product } from '../../../shared/api/types';
import { AddToCart } from '../../cart/components/AddToCart';
import { formatVnd } from '../../../shared/lib/format';

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.products.detail(productId!),
    queryFn: () => api.get<Product>(`/products/${productId}`),
    enabled: !!productId,
  });

  if (isLoading) return <p>Đang tải...</p>;

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div>
        <p>Sản phẩm không tồn tại.</p>
        <button onClick={() => navigate('/products')}>Quay lại danh sách</button>
      </div>
    );
  }

  if (error) return <p>Lỗi khi tải sản phẩm. Vui lòng thử lại.</p>;

  if (!data) return null;

  return (
    <div style={{ maxWidth: '800px' }}>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '1rem' }}>
        ← Quay lại
      </button>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '2rem',
        }}
      >
        <div>
          {data.imageUrl ? (
            // Ảnh của hãng có nền trắng → đặt trên ô nền nhạt để thấy mép ảnh trên thẻ trắng
            <div
              style={{
                display: 'grid',
                placeItems: 'center',
                aspectRatio: '1',
                padding: '24px',
                background: 'var(--bg-image-plate)',
                borderRadius: 'var(--radius-xl)',
              }}
            >
              <img
                src={data.imageUrl}
                alt={data.name}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  mixBlendMode: 'multiply',
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                aspectRatio: '1',
                background: 'var(--bg-surface-raised)',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Không có ảnh
            </div>
          )}
        </div>
        <div>
          <p style={{ color: 'var(--fg-subdued)', fontSize: '0.85rem', margin: '0 0 0.25rem' }}>
            {data.brand} · {data.category}
          </p>
          <h1 style={{ fontSize: '1.5rem', margin: '0 0 1rem' }}>{data.name}</h1>
          <p
            style={{
              fontSize: '1.75rem',
              fontWeight: 'bold',
              color: 'var(--fg-default)',
              margin: '0 0 0.5rem',
            }}
          >
            {formatVnd(data.price)}
          </p>
          <p
            style={{
              color: data.stock > 0 ? 'var(--fg-success)' : 'var(--fg-danger)',
              fontSize: '0.9rem',
            }}
          >
            {data.stock > 0 ? `Còn hàng (${data.stock})` : 'Hết hàng'}
          </p>
          <p style={{ marginTop: '1rem', lineHeight: 1.6 }}>{data.description}</p>

          <AddToCart product={data} />
        </div>
      </div>

      {/* Widget gợi ý — An làm */}
      {/* <RecommendationWidget productId={data.productId} /> */}
    </div>
  );
}
