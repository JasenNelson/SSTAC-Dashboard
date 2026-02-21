'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Eye,
  Pencil,
  Upload,
  Trash2,
  FileText,
  Calendar,
  Settings,
} from 'lucide-react';
import SubmissionCard from './SubmissionCard';
import type { DisplaySubmission } from './SubmissionCard';
import EditProjectModal from './modals/EditProjectModal';
import EditServicesModal from './modals/EditServicesModal';
import FileManagementModal from './modals/FileManagementModal';
import DeleteConfirmDialog from './modals/DeleteConfirmDialog';
import type { ReviewProjectDisplay } from './LandingPageClient';

// =============================================================================
// Status Badge
// =============================================================================

const STATUS_CONFIG: Record<
  string,
  { bg: string; text: string; label: string; pulse?: boolean }
> = {
  created: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-800 dark:text-yellow-200',
    label: 'Created',
  },
  extracting: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'Extracting',
    pulse: true,
  },
  extracted: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-800 dark:text-emerald-200',
    label: 'Extracted',
  },
  active: {
    bg: 'bg-green-100 dark:bg-green-900/30',
    text: 'text-green-800 dark:text-green-200',
    label: 'Active',
  },
  archived: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
    label: 'Archived',
  },
};

function ProjectStatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.created;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
        </span>
      )}
      {config.label}
    </span>
  );
}

// =============================================================================
// Service Badges
// =============================================================================

function ServiceBadges({ services }: { services: string[] }) {
  const maxShown = 3;
  const shown = services.slice(0, maxShown);
  const remaining = services.length - maxShown;

  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((svc) => (
        <span
          key={svc}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
        >
          {svc
            .replace(/-/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .slice(0, 24)}
        </span>
      ))}
      {remaining > 0 && (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
          +{remaining} more
        </span>
      )}
    </div>
  );
}

// =============================================================================
// Project Card
// =============================================================================

function ProjectCard({
  project,
  onEdit,
  onEditServices,
  onUpload,
  onDelete,
}: {
  project: ReviewProjectDisplay;
  onEdit: () => void;
  onEditServices: () => void;
  onUpload: () => void;
  onDelete: () => void;
}) {
  const formattedDate = new Date(project.createdAt).toLocaleDateString(
    'en-CA',
    { year: 'numeric', month: 'short', day: 'numeric' }
  );

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
            {project.siteId}
          </h3>
          {project.siteName && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {project.siteName}
            </p>
          )}
        </div>
        <ProjectStatusBadge status={project.status} />
      </div>

      {/* Details */}
      <div className="space-y-2 mb-4">
        {project.applicantName && (
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <span className="text-gray-400 dark:text-gray-500 mr-2 font-medium">Applicant:</span>
            {project.applicantName}
          </div>
        )}
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 flex-wrap gap-1">
          <span className="text-gray-400 dark:text-gray-500 mr-1 font-medium">Type:</span>
          {project.applicationTypes.map((t) => (
            <span
              key={t}
              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
            >
              {t.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
            </span>
          ))}
        </div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0" />
          {project.fileCount} file{project.fileCount !== 1 ? 's' : ''}
        </div>
        <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
          <Calendar className="h-4 w-4 text-gray-400 dark:text-gray-500 mr-2 flex-shrink-0" />
          {formattedDate}
        </div>
      </div>

      {/* Services */}
      {project.selectedServices.length > 0 && (
        <div className="mb-4">
          <ServiceBadges services={project.selectedServices} />
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
        <Link
          href={`/regulatory-review/${project.id}`}
          className="inline-flex items-center justify-center p-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
          title="View project"
        >
          <Eye className="h-4 w-4" />
        </Link>
        <button
          onClick={onEdit}
          className="inline-flex items-center justify-center p-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
          title="Edit site info"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onEditServices}
          className="inline-flex items-center justify-center p-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
          title="Edit services"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={onUpload}
          className="inline-flex items-center justify-center p-2 text-sm text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
          title="Manage files"
        >
          <Upload className="h-4 w-4" />
        </button>
        <div className="flex-1" />
        <button
          onClick={onDelete}
          className="inline-flex items-center justify-center p-2 text-sm text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Delete project"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

interface ActiveReviewsGridProps {
  projects: ReviewProjectDisplay[];
  legacySubmissions: DisplaySubmission[];
}

type ModalState =
  | { type: 'none' }
  | { type: 'edit'; project: ReviewProjectDisplay }
  | { type: 'edit-services'; project: ReviewProjectDisplay }
  | { type: 'upload'; project: ReviewProjectDisplay }
  | { type: 'delete'; project: ReviewProjectDisplay };

export default function ActiveReviewsGrid({
  projects,
  legacySubmissions,
}: ActiveReviewsGridProps) {
  const [modal, setModal] = useState<ModalState>({ type: 'none' });

  const closeModal = () => setModal({ type: 'none' });

  const handleSaveOrDelete = () => {
    closeModal();
    // Trigger a page refresh to pick up changes from the server component
    window.location.reload();
  };

  return (
    <>
      {/* Projects Grid */}
      {projects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onEdit={() => setModal({ type: 'edit', project })}
              onEditServices={() =>
                setModal({ type: 'edit-services', project })
              }
              onUpload={() => setModal({ type: 'upload', project })}
              onDelete={() => setModal({ type: 'delete', project })}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <FileText className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
          <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
            No review projects
          </h3>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Create a new review project using the &quot;New Review&quot; tab.
          </p>
        </div>
      )}

      {/* Legacy Submissions */}
      {legacySubmissions.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            <span className="px-3 text-sm text-gray-400 dark:text-gray-500 uppercase tracking-wider">
              Legacy Submissions
            </span>
            <span className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {legacySubmissions.map((submission) => (
              <SubmissionCard key={submission.id} submission={submission} />
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      {modal.type === 'edit' && (
        <EditProjectModal
          project={modal.project}
          isOpen
          onClose={closeModal}
          onSave={handleSaveOrDelete}
        />
      )}
      {modal.type === 'edit-services' && (
        <EditServicesModal
          project={modal.project}
          isOpen
          onClose={closeModal}
          onSave={handleSaveOrDelete}
        />
      )}
      {modal.type === 'upload' && (
        <FileManagementModal
          projectId={modal.project.id}
          isOpen
          onClose={closeModal}
        />
      )}
      {modal.type === 'delete' && (
        <DeleteConfirmDialog
          project={{
            id: modal.project.id,
            siteId: modal.project.siteId,
            siteName: modal.project.siteName,
          }}
          isOpen
          onClose={closeModal}
          onDeleted={handleSaveOrDelete}
        />
      )}
    </>
  );
}
