import { ComponentChildren, VNode, h, Fragment } from "preact";
import type { HTMLAttributes } from "react";
import { ExperienceConfig } from "../lib/consent-types";

import GpcInfo from "./GpcInfo";
import ExperienceDescription from "./ExperienceDescription";
import { getConsentContext } from "../fides";

export interface ConsentContentProps {
  title: HTMLAttributes<HTMLHeadingElement>;
  experience: ExperienceConfig;
  children: ComponentChildren;
  className?: string;
  onVendorPageClick?: () => void;
  renderModalFooter: () => VNode;
}

const ConsentModal = ({
  title,
  className,
  experience,
  renderModalFooter,
  children,
  onVendorPageClick,
}: ConsentContentProps) => {
  const showGpcBadge = getConsentContext().globalPrivacyControl;

  return (
    <Fragment>
      <div
        data-testid="consent-content"
        id="fides-consent-content"
        className={className}
      >
        <div className="fides-modal-body">
          <div
            data-testid="fides-modal-title"
            {...title}
            className="fides-modal-title"
          >
            {experience.title}
          </div>
          <p
            data-testid="fides-modal-description"
            className="fides-modal-description"
          >
            <ExperienceDescription
              onVendorPageClick={onVendorPageClick}
              description={experience.description}
            />
          </p>
          {showGpcBadge && <GpcInfo />}
          {children}
        </div>
      </div>
      <div className="fides-modal-footer">{renderModalFooter()}</div>
    </Fragment>
  );
};

export default ConsentModal;