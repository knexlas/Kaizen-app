import { useState } from 'react';
import { Button, DurationSelect, ProjectSelect, inputClass } from './ui';

/**
 * One-line task input: title, project, duration and one button per target
 * (e.g. "Today" / "This week"). Calls onSubmit({ goalId, title, minutes, target }).
 */
export default function TaskComposer({ lean, targets, onSubmit, fixedProjectId = null, initialTitle = '', placeholder = 'Add a task…', autoFocus = false }) {
  const [title, setTitle] = useState(initialTitle);
  const [minutes, setMinutes] = useState(30);
  const [projectId, setProjectId] = useState(fixedProjectId ?? lean.projects[0]?.id ?? '');
  const [newProject, setNewProject] = useState('');

  const creatingProject = !fixedProjectId && projectId === '__new';
  const canSubmit = title.trim() && (!creatingProject || newProject.trim());

  const submit = (target) => {
    if (!canSubmit) return;
    let goalId = fixedProjectId ?? projectId;
    let projectTitle = lean.projects.find((p) => p.id === goalId)?.title ?? null;
    if (creatingProject) {
      projectTitle = newProject.trim();
      goalId = lean.addProject(projectTitle);
    }
    if (!goalId) {
      projectTitle = lean.projects[0]?.title ?? 'General';
      goalId = lean.projects[0]?.id ?? lean.addProject('General');
    }
    onSubmit({ goalId, projectTitle, title: title.trim(), minutes, target });
    setTitle('');
    if (creatingProject) {
      setProjectId(goalId);
      setNewProject('');
    }
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => { e.preventDefault(); submit(targets[0].value); }}
    >
      <input
        className={`${inputClass} min-w-[10rem] flex-1`}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        aria-label="Task title"
        autoFocus={autoFocus}
      />
      {!fixedProjectId && <ProjectSelect projects={lean.projects} value={projectId} onChange={setProjectId} />}
      {creatingProject && (
        <input
          className={`${inputClass} w-40`}
          value={newProject}
          onChange={(e) => setNewProject(e.target.value)}
          placeholder="Project name"
          aria-label="New project name"
        />
      )}
      <DurationSelect value={minutes} onChange={setMinutes} />
      {targets.map((t, i) => (
        <Button key={t.value} tone={i === 0 ? 'primary' : 'outline'} type={i === 0 ? 'submit' : 'button'} disabled={!canSubmit} onClick={i === 0 ? undefined : () => submit(t.value)}>
          {t.label}
        </Button>
      ))}
    </form>
  );
}
