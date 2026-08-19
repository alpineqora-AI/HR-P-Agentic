package com.taportal.domain.talent;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** An internal employee in the talent marketplace (Eightfold). */
@Entity
@Table(name = "internal_employee")
@Getter
@NoArgsConstructor
@AllArgsConstructor
public class InternalEmployee {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Setter
    @Column(nullable = false)
    private String name;

    @Setter
    @Column(name = "current_title", nullable = false)
    private String currentRole;

    @Setter
    @Column(nullable = false)
    private String department;

    @Setter
    @Column(name = "tenure_years", nullable = false, precision = 4, scale = 1)
    private BigDecimal tenureYears;

    @Setter
    @Column
    private String location;
}
