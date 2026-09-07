import { Container } from '@/components/ui/Container';
import { BookingForm } from '@/components/checkout/BookingForm';
import { PriceBreakdown } from '@/components/checkout/PriceBreakdown';

export default function CheckoutPage() {
  return (
    <div className="bg-slate-50 pb-16">
      <Container className="grid grid-cols-1 gap-8 py-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 order-2 lg:order-1">
          <h1 className="mb-5 text-2xl font-bold text-slate-900">예약 정보 입력</h1>
          <BookingForm />
        </div>
        <div className="order-1 lg:order-2">
          <PriceBreakdown />
        </div>
      </Container>
    </div>
  );
}
