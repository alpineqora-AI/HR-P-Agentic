package com.taportal.domain.interview;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InterviewRoundMemberRepository extends JpaRepository<InterviewRoundMember, UUID> {

    List<InterviewRoundMember> findByRoundId(UUID roundId);

    void deleteByRoundId(UUID roundId);
}
