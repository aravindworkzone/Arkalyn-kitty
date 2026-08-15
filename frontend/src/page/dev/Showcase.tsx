import { useState } from "react";
import { ActionButton, Badge, Button, Card, Chip, ChoiceGroup, ColorPicker, DataList, DatePicker, Disclosure, FormField, Input, Label, Note, Select, Switch, Textarea } from "../../components/ui";
import type { BadgeTone, ButtonVariant, SelectOption } from "../../components/ui";
import { CATEGORICAL } from "../../helpers/chartPalette";
import useTheme from "../../hooks/useTheme";

/**
 * Dev-only isolation harness for the design-system primitives — every variant
 * and state side by side, in both themes.
 *
 * Route is DEV-gated in App.tsx, so this never ships. It is also the regression
 * surface for the phase-6 QA sweep: if a primitive looks wrong here, it is
 * wrong everywhere, and that is much cheaper to spot than screen by screen.
 */

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "destructive"];
const TONES: BadgeTone[] = ["success", "warning", "error", "brand", "gray"];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3">
            <h2 className="text-theme-xs font-semibold uppercase tracking-widest text-fg-muted">
                {title}
            </h2>
            {children}
        </section>
    );
}

const MEMBERS: SelectOption[] = [
    { value: "u1", label: "Aravind A", description: "SUPER_ADMIN · ai5@lingaasys.com" },
    { value: "u2", label: "Priya R", description: "ADMIN · priya@example.com" },
    { value: "u3", label: "Karthik M", description: "MEMBER · karthik@example.com" },
    { value: "u4", label: "Divya S", description: "MEMBER · divya@example.com" },
    { value: "u5", label: "Ramesh K", description: "MEMBER · ramesh@example.com" },
    { value: "u6", label: "Anita J", description: "MEMBER · anita@example.com" },
    { value: "u7", label: "Suresh B", description: "MEMBER (left)", disabled: true },
    { value: "u8", label: "Meena V", description: "MEMBER · meena@example.com" },
];

const CATEGORIES: SelectOption[] = [
    { value: "c1", label: "Food" },
    { value: "c2", label: "Travel" },
    { value: "c3", label: "Utilities" },
];

export default function Showcase() {
    const { theme, toggle, isSystem } = useTheme();
    const [text, setText] = useState("");
    const [member, setMember] = useState("");
    const [category, setCategory] = useState("c2");
    const [date, setDate] = useState("");
    const [rangeStart, setRangeStart] = useState("");
    const [listPage, setListPage] = useState(3);
    const [switchOn, setSwitchOn] = useState(true);
    const [swatch, setSwatch] = useState<string>(CATEGORICAL[0]);
    const [discOpen, setDiscOpen] = useState(false);
    const [discErrOpen, setDiscErrOpen] = useState(false);

    return (
        <div className="min-h-screen bg-surface px-6 lg:px-8 py-12 lg:py-16 text-fg">
            <div className="mx-auto max-w-5xl space-y-12">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-title-sm font-semibold text-fg">Design system</h1>
                        <p className="text-theme-sm text-fg-muted">
                            Theme: <span className="font-medium text-fg">{theme}</span>
                            {isSystem && " (following OS)"}
                        </p>
                    </div>
                    <Button variant="secondary" onClick={toggle}>
                        Switch to {theme === "dark" ? "light" : "dark"}
                    </Button>
                </header>

                <Section title="Buttons">
                    <Card className="space-y-4">
                        {(["md", "sm"] as const).map((size) => (
                            <div key={size} className="flex flex-wrap items-center gap-3">
                                {VARIANTS.map((variant) => (
                                    <Button key={variant} variant={variant} size={size}>
                                        {variant}
                                    </Button>
                                ))}
                            </div>
                        ))}
                        <div className="flex flex-wrap items-center gap-3">
                            <Button disabled>disabled</Button>
                            <Button variant="secondary" disabled>
                                disabled
                            </Button>
                            <Button loading loadingLabel="Saving…">
                                Save
                            </Button>
                            <Button variant="destructive" loading>
                                Delete
                            </Button>
                        </div>
                        <Button fullWidth>full width</Button>
                    </Card>
                </Section>

                <Section title="Badges">
                    <Card>
                        <div className="flex flex-wrap gap-2">
                            {TONES.map((tone) => (
                                <Badge key={tone} tone={tone}>
                                    {tone}
                                </Badge>
                            ))}
                        </div>
                    </Card>
                </Section>

                <Section title="Form fields">
                    <Card className="grid gap-5 sm:grid-cols-2">
                        <FormField label="Title" required hint="Between 3 and 100 characters.">
                            <Input
                                placeholder="Dinner at Anjappar"
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                            />
                        </FormField>

                        <FormField label="Amount" required error="Amount exceeds group balance.">
                            <Input inputMode="decimal" placeholder="0" defaultValue="4500" />
                        </FormField>

                        <FormField label="Disabled">
                            <Input disabled placeholder="Not editable" />
                        </FormField>

                        <FormField label="No wrapper label">
                            <Input placeholder="Plain input" />
                        </FormField>
                    </Card>
                </Section>

                <Section title="Select (searchable)">
                    <Card className="grid gap-5 sm:grid-cols-2">
                        <FormField label="Paid by" required hint="Search filters name and email.">
                            <Select
                                options={MEMBERS}
                                value={member}
                                onChange={setMember}
                                placeholder="Choose a member"
                            />
                        </FormField>

                        <FormField label="Category" error="Category no longer exists in this group.">
                            <Select
                                options={CATEGORIES}
                                value={category}
                                onChange={setCategory}
                                placeholder="Choose a category"
                            />
                        </FormField>

                        <FormField label="Short list (search auto-hidden)">
                            <Select
                                options={CATEGORIES}
                                value=""
                                onChange={() => {}}
                                placeholder="Under the search threshold"
                            />
                        </FormField>

                        <FormField label="Disabled">
                            <Select
                                options={CATEGORIES}
                                value=""
                                onChange={() => {}}
                                placeholder="Not editable"
                                disabled
                            />
                        </FormField>
                    </Card>
                </Section>

                <Section title="Date picker">
                    <Card className="grid gap-5 sm:grid-cols-2">
                        <FormField
                            label="Expense date"
                            required
                            hint="Custom calendar on pointer devices; native wheel on touch."
                        >
                            <DatePicker value={date} onChange={setDate} max={new Date().toISOString().slice(0, 10)} />
                        </FormField>

                        <FormField label="From" hint="Bounded — nothing before 2026-01-01.">
                            <DatePicker value={rangeStart} onChange={setRangeStart} min="2026-01-01" />
                        </FormField>

                        <FormField label="Invalid" error="End date is before the start date.">
                            <DatePicker value="2026-03-14" onChange={() => {}} invalid />
                        </FormField>

                        <FormField label="Disabled">
                            <DatePicker value="" onChange={() => {}} disabled />
                        </FormField>
                    </Card>
                </Section>

                <Section title="DataList">
                    <div className="grid gap-4 lg:grid-cols-2">
                        <DataList
                            pagination={{
                                page: listPage,
                                totalPages: 9,
                                total: 173,
                                unitLabel: "users",
                                onPageChange: setListPage,
                            }}
                        >
                            {MEMBERS.slice(0, 4).map((m) => (
                                <div key={m.value} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-hover">
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-theme-sm text-fg">{m.label}</p>
                                        <p className="truncate text-theme-xs text-fg-muted">{m.description}</p>
                                    </div>
                                    <Badge tone={m.disabled ? "gray" : "success"}>
                                        {m.disabled ? "LEFT" : "ACTIVE"}
                                    </Badge>
                                </div>
                            ))}
                        </DataList>

                        <div className="space-y-4">
                            <DataList isLoading loadingRows={3} />
                            <DataList isEmpty emptyLabel="No promo codes yet." />
                            <DataList error="Could not reach the server." />
                        </div>
                    </div>
                </Section>

                <Section title="Label / standalone">
                    <Card className="space-y-2">
                        <Label required>Required label</Label>
                        <Label>Plain label</Label>
                    </Card>
                </Section>

                <Section title="Card surfaces">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Card title="With header" headerRight={<Badge tone="brand">PRO</Badge>}>
                            <p className="text-theme-sm text-fg-muted">
                                Header strip, bordered, body padded.
                            </p>
                        </Card>
                        <Card>
                            <p className="text-theme-sm text-fg-muted">Plain padded card.</p>
                        </Card>
                        <Card padded={false} className="sm:col-span-2">
                            <div className="divide-y divide-line">
                                {["First row", "Second row", "Third row"].map((row) => (
                                    <div
                                        key={row}
                                        className="px-5 py-3 text-theme-sm text-fg hover:bg-surface-hover"
                                    >
                                        {row}
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </Section>

                <Section title="Chip · Switch · ActionButton · ColorPicker">
                    <Card>
                        <div className="space-y-5">
                            <div className="flex flex-wrap gap-2">
                                <Chip selected>Selected</Chip>
                                <Chip>Unselected</Chip>
                                <Chip selected accentColor={CATEGORICAL[3]}>Category accent</Chip>
                                <Chip accentColor={CATEGORICAL[3]}>Category, off</Chip>
                                <Chip dashed>+ Add</Chip>
                            </div>

                            <div className="flex items-center gap-4">
                                <Switch checked={switchOn} onChange={setSwitchOn} ariaLabel="Demo switch" />
                                <span className="text-theme-sm text-fg-muted">
                                    {switchOn ? "on" : "off"}
                                </span>
                                <Switch checked disabled onChange={() => {}} ariaLabel="Disabled switch" />
                            </div>

                            <div className="grid gap-2 sm:grid-cols-5">
                                <ActionButton tone="brand">Brand</ActionButton>
                                <ActionButton tone="success">Success</ActionButton>
                                <ActionButton tone="warning">Warning</ActionButton>
                                <ActionButton tone="error">Error</ActionButton>
                                <ActionButton tone="neutral">Neutral</ActionButton>
                            </div>

                            <ColorPicker
                                options={CATEGORICAL}
                                value={swatch}
                                onChange={setSwatch}
                                customLabel="Custom colour"
                            />
                        </div>
                    </Card>
                </Section>

                <Section title="Chip variants">
                    <Card>
                        <div className="space-y-5">
                            <p className="text-theme-xs text-fg-muted">
                                <code>pill</code> is the dense filter chip and keeps its original
                                geometry. The form variants are 44px touch targets and mark
                                selection with a check, not colour alone.
                            </p>

                            <ChoiceGroup label="choice">
                                <Chip variant="choice" selected accentColor={CATEGORICAL[1]}>Food</Chip>
                                <Chip variant="choice" accentColor={CATEGORICAL[2]}>Travel</Chip>
                                <Chip variant="choice" accentColor={CATEGORICAL[4]}>Rent</Chip>
                                <Chip variant="choice" dashed>+ Add</Chip>
                            </ChoiceGroup>

                            <ChoiceGroup label="tile" layout="grid" itemsClass="grid-cols-2 xsm:grid-cols-4">
                                <Chip variant="tile" selected>Cash</Chip>
                                <Chip variant="tile">UPI</Chip>
                                <Chip variant="tile">Card</Chip>
                                <Chip variant="tile">Bank</Chip>
                            </ChoiceGroup>

                            <ChoiceGroup label="avatar">
                                {["Asha", "Ravi", "Meera"].map((n, i) => (
                                    <Chip key={n} variant="avatar" selected={i === 0}>
                                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-hover text-theme-2xs font-bold text-fg-muted">
                                            {n.slice(0, 2).toUpperCase()}
                                        </span>
                                        {n}
                                    </Chip>
                                ))}
                            </ChoiceGroup>

                            <p className="text-theme-2xs text-fg-muted">
                                Each ChoiceGroup above is one tab stop — arrows move within it.
                            </p>
                        </div>
                    </Card>
                </Section>

                <Section title="Note">
                    <Card>
                        <div className="space-y-3">
                            <Note tone="neutral">Neutral — a plain aside.</Note>
                            <Note tone="info">Info — context the user did not ask for.</Note>
                            <Note tone="warning">
                                Warning — worth reading, but nothing is blocked.
                            </Note>
                            <Note tone="error">
                                Error — the only tone that gets a panel.
                            </Note>
                            <Note
                                tone="warning"
                                action={
                                    <button type="button" className="shrink-0 font-semibold underline underline-offset-2">
                                        Fix it
                                    </button>
                                }
                            >
                                With a one-tap fix in the action slot.
                            </Note>
                        </div>
                    </Card>
                </Section>

                <Section title="Disclosure">
                    <div className="space-y-3">
                        <Disclosure
                            title="Payment"
                            summary="Cash · paid by you"
                            open={discOpen}
                            onOpenChange={setDiscOpen}
                        >
                            <p className="text-theme-sm text-fg-muted">
                                The summary shows only while closed, so a collapsed section still
                                says what it will submit.
                            </p>
                        </Disclosure>
                        <Disclosure
                            title="With an error"
                            summary="Needs attention"
                            error
                            open={discErrOpen}
                            onOpenChange={setDiscErrOpen}
                        >
                            <p className="text-theme-sm text-fg-muted">
                                Collapsed content is <code>inert</code>, so it is not tabbable.
                            </p>
                        </Disclosure>
                    </div>
                </Section>

                <Section title="Textarea">
                    <Card>
                        <FormField label="Description" hint="Wired to FormField like Input is.">
                            <Textarea rows={3} placeholder="Add a note…" />
                        </FormField>
                    </Card>
                </Section>

                <Section title="Semantic surface tokens">
                    <Card padded={false}>
                        <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
                            {[
                                ["bg-surface", "bg-surface"],
                                ["bg-surface-raised", "bg-surface-raised"],
                                ["bg-surface-overlay", "bg-surface-overlay"],
                                ["bg-surface-hover", "bg-surface-hover"],
                                ["text-fg", "bg-surface-raised text-fg"],
                                ["text-fg-muted", "bg-surface-raised text-fg-muted"],
                                // Still listed even though screens must not use
                                // it for real text — placeholders do, and the
                                // inventory has to stay complete.
                                ["text-fg-subtle", "bg-surface-raised text-fg-subtle"],
                                ["border-line", "bg-surface-raised"],
                                ["border-line-strong", "bg-surface-raised"],
                                ["bg-scrim", "bg-scrim text-on-accent"],
                                ["text-on-accent", "bg-brand-500 text-on-accent"],
                            ].map(([name, cls]) => (
                                <div key={name} className={`${cls} p-4 text-theme-xs`}>
                                    {name}
                                </div>
                            ))}
                        </div>
                    </Card>
                </Section>
            </div>
        </div>
    );
}
