import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { CollectionReview } from '@/components/themes/collection-review';
import { doveDesign } from '@/lib/themes/builder/dove-velvet';

export default async function DoveReviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const qrDataUrl = await QRCode.toDataURL('dove-velvet-preview-not-an-entry-pass', { margin: 1, width: 320 });
  return <CollectionReview designs={[doveDesign()]} qrDataUrl={qrDataUrl} title="حمام الوصل" initialScene="cover" newDesign />;
}
