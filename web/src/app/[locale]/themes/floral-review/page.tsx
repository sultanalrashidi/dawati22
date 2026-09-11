import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { CollectionReview } from '@/components/themes/collection-review';
import { floralDesigns } from '@/lib/themes/builder/floral-pair';

export default async function FloralReviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  const qrDataUrl = await QRCode.toDataURL('floral-pair-preview-not-an-entry-pass', { margin: 1, width: 320 });
  return <CollectionReview designs={floralDesigns()} qrDataUrl={qrDataUrl} title="حديقة اللؤلؤ · ورد وفراشات" initialScene="cover" newDesign />;
}
