package com.taportal.domain.talent;

import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Data access for TalentPoolMember rows (Spring Data JPA; derived queries only). */
public interface TalentPoolMemberRepository extends JpaRepository<TalentPoolMember, TalentPoolMemberId> {

    long countByPoolId(UUID poolId);
}
