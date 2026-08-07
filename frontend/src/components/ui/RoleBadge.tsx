import { roleGrade, roleNs } from "../../helpers/constants";
import InfoIcon from "../Icon/Info";
import { type Group } from "../../interface/group";
import DetailModal from "../DetailModal";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import RoleDetails from "../RoleDetails";

interface RoleBadgeProps {
    Role: Group["role"];
    info?: boolean;
    groupName?: string;
}


const RoleBadge = ({ Role, info = true, groupName }: RoleBadgeProps) => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const label = t(`roles.name.${roleNs[Role]}`);

    const RolePermission = (e: React.MouseEvent) => {
        if (!info) return;
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(true);
    };

    return (
        <>
        <button
            type="button"
            aria-label={t("roles.badgeAria", { role: label })}
            className={`text-theme-2xs font-semibold px-2 py-0.5 flex items-center gap-1.5 rounded-md cursor-pointer border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 ${roleGrade[Role]}`}
            onClick={RolePermission}
        >
            <span>{label}</span> {info && <InfoIcon />}
        </button>
        {info && <DetailModal isOpen={isOpen} onClose={() => setIsOpen(false)} title={t("roles.title")}>
            <RoleDetails role={Role} groupName={groupName} />
        </DetailModal>}
        </>
    );
}

export default RoleBadge;