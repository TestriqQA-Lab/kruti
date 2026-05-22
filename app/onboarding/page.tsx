import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OnboardingWizard from "@/components/OnboardingWizard";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      onboardingCompleted: true,
      name: true,
      headline: true,
      industry: true,
      image: true,
    },
  });

  // If already completed, go to dashboard
  if (user?.onboardingCompleted) redirect("/dashboard");

  return (
    <OnboardingWizard
      user={{
        name: user?.name,
        headline: user?.headline,
        industry: user?.industry,
        image: user?.image,
      }}
    />
  );
}
