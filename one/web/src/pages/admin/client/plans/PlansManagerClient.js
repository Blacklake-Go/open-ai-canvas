'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/admin/AdminUi';
import { Plus } from 'lucide-react';
import PlanCardEditor from './PlanCardEditor';
import CreatePlanModal from './CreatePlanModal';

export default function PlansManagerClient({ initialPlans = [] }) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [plans, setPlans] = useState(initialPlans);

  const handleCreated = (newPlan) => {
    setPlans((prev) => [...prev, newPlan]);
  };

  return (
    <>
      <PageHeader
        eyebrow="前端与权益管理"
        title="套餐配置与专属权益"
        description="管理 Studio 前台会员与订阅套餐展示，支持动态配置价格、积分额度、并发上限，以及可勾选专属特权（去水印、最新模型专属使用权等）。"
      >
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow-lg shadow-brand/20 hover:bg-brand-hover transition-colors cursor-pointer"
        >
          <Plus className="size-4" />
          <span>新增套餐</span>
        </button>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCardEditor key={plan.id} plan={plan} />
        ))}
      </div>

      <CreatePlanModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
