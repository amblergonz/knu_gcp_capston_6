import { Container } from '@/components/ui/Container';
import { SuccessCard } from '@/components/confirmation/SuccessCard';

export default function ConfirmationPage() {
  return (
    <div className="bg-sky-50 pb-20">
      <Container className="max-w-[720px] py-16">
        <SuccessCard />
      </Container>
    </div>
  );
}
