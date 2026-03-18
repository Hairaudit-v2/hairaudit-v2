import DoctorComingSoon from "../DoctorComingSoon";

export default function DoctorPublicProfilePage() {
  return (
    <DoctorComingSoon
      title="Public profile settings"
      description="Profile and visibility settings for how you appear on leaderboards and in the directory are coming soon. Your submitted cases already contribute to benchmarking."
      alternative={{ label: "View doctor leaderboards", href: "/leaderboards/doctors" }}
    />
  );
}
