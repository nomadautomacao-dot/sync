"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { StepAddress } from "@/components/forms/company-wizard/step-address";
import { StepContact } from "@/components/forms/company-wizard/step-contact";
import { StepIdentity } from "@/components/forms/company-wizard/step-identity";
import { StepModules } from "@/components/forms/company-wizard/step-modules";
import { StepReview } from "@/components/forms/company-wizard/step-review";
import type { CompanyCreateInput, WizardStep } from "@/components/forms/company-wizard/types";
import { WizardLayout } from "@/components/forms/company-wizard/wizard-layout";
import { Button } from "@/components/ui/button";
import { companyCreateSchema, type Company } from "@/core/domain/organization";
import { apiClient } from "@/core/lib/api-client";

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 1,
    title: "Identidade",
    description: "Marca e dados institucionais",
    fields: [
      "logo",
      "color",
      "name",
      "tradingName",
      "cnpj",
      "stateRegistration",
      "cityRegistration",
      "foundedAt",
    ],
  },
  {
    id: 2,
    title: "Endereco",
    description: "Localizacao e dados postais",
    fields: ["zipCode", "street", "number", "complement", "neighborhood", "city", "state"],
  },
  {
    id: 3,
    title: "Contato",
    description: "Canais da empresa e responsavel",
    fields: [
      "phone",
      "phoneSecondary",
      "email",
      "website",
      "contactName",
      "contactPosition",
      "contactEmail",
      "contactPhone",
    ],
  },
  {
    id: 4,
    title: "Segmento",
    description: "Classificacao e modulos",
    fields: ["segment", "description", "size", "taxRegime", "enabledModules"],
  },
  {
    id: 5,
    title: "Revisao",
    description: "Conferencia final",
    fields: [],
  },
];

const DEFAULT_VALUES: CompanyCreateInput = {
  name: "",
  tradingName: "",
  cnpj: "",
  stateRegistration: "",
  cityRegistration: "",
  foundedAt: "",
  logo: "",
  color: "#6366F1",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
  phone: "",
  phoneSecondary: "",
  email: "",
  website: "",
  contactName: "",
  contactPosition: "",
  contactEmail: "",
  contactPhone: "",
  segment: "consultoria",
  description: "",
  size: undefined,
  taxRegime: undefined,
  status: "active",
  enabledModules: [],
};

function stepTransition(stepIndex: number) {
  return {
    initial: { opacity: 0, x: 24 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -24 },
    transition: { duration: 0.2, ease: "easeOut" as const },
  };
}

export default function NewCompanyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);

  const form = useForm<CompanyCreateInput>({
    resolver: zodResolver(companyCreateSchema) as Resolver<CompanyCreateInput>,
    defaultValues: DEFAULT_VALUES,
    mode: "onTouched",
  });

  const createCompanyMutation = useMutation({
    mutationFn: (payload: CompanyCreateInput) => apiClient.post<Company>("/api/companies", payload),
    onSuccess: async (company) => {
      toast.success("Empresa criada com sucesso.");
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      await queryClient.invalidateQueries({ queryKey: ["audit"] });
      router.push(`/companies/${company.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const isSubmitting = form.formState.isSubmitting || createCompanyMutation.isPending;
  const isReviewStep = currentStep === WIZARD_STEPS.length - 1;
  const progress = useMemo(
    () => ((currentStep + 1) / WIZARD_STEPS.length) * 100,
    [currentStep],
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <StepIdentity form={form} />;
      case 1:
        return <StepAddress form={form} />;
      case 2:
        return <StepContact form={form} />;
      case 3:
        return <StepModules form={form} />;
      case 4:
        return <StepReview form={form} onEditStep={setCurrentStep} />;
      default:
        return null;
    }
  };

  const goToNextStep = async () => {
    const fields = WIZARD_STEPS[currentStep]?.fields ?? [];
    const valid = fields.length > 0 ? await form.trigger(fields, { shouldFocus: true }) : true;
    if (!valid) {
      toast.error("Revise os campos obrigatorios deste passo.");
      return;
    }

    setCurrentStep((previous) => Math.min(previous + 1, WIZARD_STEPS.length - 1));
  };

  const goToPreviousStep = () => {
    setCurrentStep((previous) => Math.max(previous - 1, 0));
  };

  const submitCompany = form.handleSubmit(async (payload) => {
    await createCompanyMutation.mutateAsync(payload);
  });

  return (
    <div className="min-h-full bg-[var(--sync-bg-primary)] px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" asChild>
            <Link href="/companies">
              <ArrowLeft className="h-4 w-4" />
              Voltar para empresas
            </Link>
          </Button>
          <div className="space-y-1 text-right">
            <p className="text-xs uppercase tracking-wider text-[var(--sync-text-tertiary)]">Cadastro</p>
            <h1 className="text-2xl font-semibold text-[var(--sync-text-primary)]">Nova empresa</h1>
          </div>
        </div>

        <form onSubmit={submitCompany}>
          <WizardLayout
            steps={WIZARD_STEPS}
            currentStep={currentStep}
            progress={progress}
            onSelectStep={(stepIndex) => {
              if (stepIndex <= currentStep) {
                setCurrentStep(stepIndex);
              }
            }}
            footer={
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goToPreviousStep}
                  disabled={currentStep === 0 || isSubmitting}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Voltar
                </Button>

                {isReviewStep ? (
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Criar empresa
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void goToNextStep()} disabled={isSubmitting}>
                    Proximo
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            }
          >
            <AnimatePresence mode="wait">
              <motion.div key={currentStep} {...stepTransition(currentStep)}>
                {renderStep()}
              </motion.div>
            </AnimatePresence>
          </WizardLayout>
        </form>
      </div>
    </div>
  );
}
